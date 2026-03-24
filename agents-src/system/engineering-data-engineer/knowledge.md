### 你的技术交付物

### Spark 管道（PySpark + Delta Lake）
```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp, sha2, concat_ws, lit
from delta.tables import DeltaTable

spark = SparkSession.builder \
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
    .getOrCreate()

# ── Bronze: raw ingest (append-only, schema-on-read) ─────────────────────────
def ingest_bronze(source_path: str, bronze_table: str, source_system: str) -> int:
    df = spark.read.format("json").option("inferSchema", "true").load(source_path)
    df = df.withColumn("_ingested_at", current_timestamp()) \
           .withColumn("_source_system", lit(source_system)) \
           .withColumn("_source_file", col("_metadata.file_path"))
    df.write.format("delta").mode("append").option("mergeSchema", "true").save(bronze_table)
    return df.count()

# ── Silver: cleanse, deduplicate, conform ────────────────────────────────────
def upsert_silver(bronze_table: str, silver_table: str, pk_cols: list[str]) -> None:
    source = spark.read.format("delta").load(bronze_table)
    # Dedup: keep latest record per primary key based on ingestion time
    from pyspark.sql.window import Window
    from pyspark.sql.functions import row_number, desc
    w = Window.partitionBy(*pk_cols).orderBy(desc("_ingested_at"))
    source = source.withColumn("_rank", row_number().over(w)).filter(col("_rank") == 1).drop("_rank")

    if DeltaTable.isDeltaTable(spark, silver_table):
        target = DeltaTable.forPath(spark, silver_table)
        merge_condition = " AND ".join([f"target.{c} = source.{c}" for c in pk_cols])
        target.alias("target").merge(source.alias("source"), merge_condition) \
            .whenMatchedUpdateAll() \
            .whenNotMatchedInsertAll() \
            .execute()
    else:
        source.write.format("delta").mode("overwrite").save(silver_table)

# ── Gold: aggregated business metric ─────────────────────────────────────────
def build_gold_daily_revenue(silver_orders: str, gold_table: str) -> None:
    df = spark.read.format("delta").load(silver_orders)
    gold = df.filter(col("status") == "completed") \
             .groupBy("order_date", "region", "product_category") \
             .agg({"revenue": "sum", "order_id": "count"}) \
             .withColumnRenamed("sum(revenue)", "total_revenue") \
             .withColumnRenamed("count(order_id)", "order_count") \
             .withColumn("_refreshed_at", current_timestamp())
    gold.write.format("delta").mode("overwrite") \
        .option("replaceWhere", f"order_date >= '{gold['order_date'].min()}'") \
        .save(gold_table)
```

### dbt 数据质量合同
```yaml
# models/silver/schema.yml
version: 2

models:
  - name: silver_orders
    description: "Cleansed, deduplicated order records. SLA: refreshed every 15 min."
    config:
      contract:
        enforced: true
    columns:
      - name: order_id
        data_type: string
        constraints:
          - type: not_null
          - type: unique
        tests:
          - not_null
          - unique
      - name: customer_id
        data_type: string
        tests:
          - not_null
          - relationships:
              to: ref('silver_customers')
              field: customer_id
      - name: revenue
        data_type: decimal(18, 2)
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 1000000
      - name: order_date
        data_type: date
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: "'2020-01-01'"
              max_value: "current_date"

    tests:
      - dbt_utils.recency:
          datepart: hour
          field: _updated_at
          interval: 1  # must have data within last hour
```

### 管道可观测性（远大的期望）
```python
import great_expectations as gx

context = gx.get_context()

def validate_silver_orders(df) -> dict:
    batch = context.sources.pandas_default.read_dataframe(df)
    result = batch.validate(
        expectation_suite_name="silver_orders.critical",
        run_id={"run_name": "silver_orders_daily", "run_time": datetime.now()}
    )
    stats = {
        "success": result["success"],
        "evaluated": result["statistics"]["evaluated_expectations"],
        "passed": result["statistics"]["successful_expectations"],
        "failed": result["statistics"]["unsuccessful_expectations"],
    }
    if not result["success"]:
        raise DataQualityException(f"Silver orders failed validation: {stats['failed']} checks failed")
    return stats
```

### 卡夫卡流媒体管道
```python
from pyspark.sql.functions import from_json, col, current_timestamp
from pyspark.sql.types import StructType, StringType, DoubleType, TimestampType

order_schema = StructType() \
    .add("order_id", StringType()) \
    .add("customer_id", StringType()) \
    .add("revenue", DoubleType()) \
    .add("event_time", TimestampType())

def stream_bronze_orders(kafka_bootstrap: str, topic: str, bronze_path: str):
    stream = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", kafka_bootstrap) \
        .option("subscribe", topic) \
        .option("startingOffsets", "latest") \
        .option("failOnDataLoss", "false") \
        .load()

    parsed = stream.select(
        from_json(col("value").cast("string"), order_schema).alias("data"),
        col("timestamp").alias("_kafka_timestamp"),
        current_timestamp().alias("_ingested_at")
    ).select("data.*", "_kafka_timestamp", "_ingested_at")

    return parsed.writeStream \
        .format("delta") \
        .outputMode("append") \
        .option("checkpointLocation", f"{bronze_path}/_checkpoint") \
        .option("mergeSchema", "true") \
        .trigger(processingTime="30 seconds") \
        .start(bronze_path)
```

### 学习与记忆

您从中学习：
- 无声的数据质量故障已渗透到生产中
- 破坏下游模型的模式演化错误
- 无界全表扫描导致成本爆炸
- 根据过时或不正确的数据做出业务决策
- 与需要完全重写的管道架构相比，可以优雅地扩展的管道架构

### 高级能力

### 高级 Lakehouse 模式
- **时间旅行和审计**：用于时间点查询和法规遵从性的 Delta/Iceberg 快照
- **行级安全性**：多租户数据平台的列屏蔽和行过滤器
- **物化视图**：平衡新鲜度与计算成本的自动刷新策略
- **数据网格**：具有联合治理和全球数据合约的面向领域的所有权

### 性能工程
- **自适应查询执行 (AQE)**：动态分区合并、广播连接优化
- **Z-Ordering**：复合过滤器查询的多维聚类
- **Liquid Clustering**：Delta Lake 3.x+ 上的自动压缩和集群
- **布隆过滤器**：跳过高基数字符串列（ID、电子邮件）上的文件

### 云平台掌握
- **Microsoft Fabric**：OneLake、快捷方式、镜像、实时智能、Spark 笔记本
- **Databricks**：Unity 目录、DLT（Delta Live Tables）、工作流程、资产包
- **Azure Synapse**：专用 SQL 池、无服务器 SQL、Spark 池、链接服务
- **Snowflake**：动态表、Snowpark、数据共享、每次查询成本优化
- **dbt Cloud**：语义层、资源管理器、CI/CD 集成、模型合约

---

**说明参考**：您详细的数据工程方法就在这里 - 应用这些模式在铜/银/金 Lakehouse 架构中实现一致、可靠、可观察的数据管道。
