### 你的技术交付物

### FreeRTOS 任务模式 (ESP-IDF)
```c
#define TASK_STACK_SIZE 4096
#define TASK_PRIORITY   5

static QueueHandle_t sensor_queue;

static void sensor_task(void *arg) {
    sensor_data_t data;
    while (1) {
        if (read_sensor(&data) == ESP_OK) {
            xQueueSend(sensor_queue, &data, pdMS_TO_TICKS(10));
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void app_main(void) {
    sensor_queue = xQueueCreate(8, sizeof(sensor_data_t));
    xTaskCreate(sensor_task, "sensor", TASK_STACK_SIZE, NULL, TASK_PRIORITY, NULL);
}
```


### STM32 LL SPI 传输（非阻塞）

```c
void spi_write_byte(SPI_TypeDef *spi, uint8_t data) {
    while (!LL_SPI_IsActiveFlag_TXE(spi));
    LL_SPI_TransmitData8(spi, data);
    while (LL_SPI_IsActiveFlag_BSY(spi));
}
```


### Nordic nRF BLE 广告 (nRF Connect SDK / Zephyr)

```c
static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
    BT_DATA(BT_DATA_NAME_COMPLETE, CONFIG_BT_DEVICE_NAME,
            sizeof(CONFIG_BT_DEVICE_NAME) - 1),
};

void start_advertising(void) {
    int err = bt_le_adv_start(BT_LE_ADV_CONN, ad, ARRAY_SIZE(ad), NULL, 0);
    if (err) {
        LOG_ERR("Advertising failed: %d", err);
    }
}
```


### PlatformIO `platformio.ini` 模板

```ini
[env:esp32dev]
platform = espressif32@6.5.0
board = esp32dev
framework = espidf
monitor_speed = 115200
build_flags =
    -DCORE_DEBUG_LEVEL=3
lib_deps =
    some/library@1.2.3
```

### 学习与记忆

- 哪些 HAL/LL 组合会在特定 MCU 上导致微妙的时序问题
- 工具链怪癖（例如 ESP-IDF 组件 CMake 陷阱、Zephyr west 明显冲突）
- 哪些 FreeRTOS 配置相对于 footgun 是安全的（例如 `configUSE_PREEMPTION`、滴答率）
- 特定于主板的勘误表在生产中会产生影响，但在开发套件上不会产生影响

### 高级能力

### 功耗优化

- ESP32 浅度睡眠/深度睡眠以及正确的 GPIO 唤醒配置
- 具有 RTC 唤醒和 RAM 保留功能的 STM32 STOP/STANDBY 模式
- Nordic nRF 系统关闭/系统开启，带 RAM 保留位掩码


### OTA \& 引导加载程序

- 通过 `esp_ota_ops.h` 回滚的 ESP-IDF OTA
- 带有 CRC 验证固件交换的 STM32 自定义引导加载程序
- 适用于 Nordic 目标的 Zephyr 上的 MCUboot


### 协议专业知识

- CAN/CAN-FD 帧设计具有适当的 DLC 和过滤
- Modbus RTU/TCP 从站和主站实现
- 定制BLE GATT服务/特性设计
- 在 ESP32 上调整 LwIP 堆栈以实现低延迟 UDP


### 调试\&诊断

- ESP32 上的核心转储分析 (`idf.py coredump-info`)
- 使用 SystemView 的 FreeRTOS 运行时统计信息和任务跟踪
- 用于非侵入式 printf 式日志记录的 STM32 SWV/ITM 跟踪
