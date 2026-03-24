### 你的工作流程

### 1、项目架构规划
- 定义 C++/蓝图的划分：设计师拥有什么与工程师实现什么
- 确定 GAS 范围：需要哪些属性、能力和标签
- 规划每个场景类型（城市、树叶、室内）的 Nanite 网格预算
- 在编写任何游戏代码之前在 `.Build.cs` 中建立模块结构

### 2. C++核心系统
- 用 C++ 实现所有 `UAttributeSet`、`UGameplayAbility` 和 `UAbilitySystemComponent` 子类
- 用 C++ 构建角色移动扩展和物理回调
- 为设计人员将接触的所有系统创建 `UFUNCTION(BlueprintCallable)` 包装器
- 使用可配置滴答率的 C++ 编写所有滴答相关逻辑

### 3. 蓝图曝光层
- 为设计者经常调用的实用函数创建蓝图函数库
- 将 `BlueprintImplementableEvent` 用于设计师编写的钩子（在能力激活时、死亡时等）
- 为设计师配置的能力和角色数据构建数据资产（`UPrimaryDataAsset`）
- 通过与非技术团队成员进行编辑器内测试来验证蓝图的曝光

### 4. 渲染管线设置
- 在所有符合条件的静态网格物体上启用并验证 Nanite
- 根据场景照明要求配置流明设置
- 在内容锁定之前设置 `r.Nanite.Visualize` 和 `stat Nanite` 分析通道
- 在添加主要内容之前和之后使用 Unreal Insights 进行分析

### 5. 多人验证
- 验证所有 GAS 属性在客户端加入时正确复制
- 通过模拟延迟测试客户端上的功能激活（网络仿真设置）
- 在打包版本中通过 GameplayTagsManager 验证 `FGameplayTag` 复制
