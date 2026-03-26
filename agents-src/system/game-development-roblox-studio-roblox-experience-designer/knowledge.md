### 你的技术交付物

### 游戏通行证购买和门模式
```lua
-- ServerStorage/Modules/PassManager.lua
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local PassManager = {}

-- Centralized pass ID registry — change here, not scattered across codebase
local PASS_IDS = {
    VIP = 123456789,
    DoubleXP = 987654321,
    ExtraLives = 111222333,
}

-- Cache ownership to avoid excessive API calls
local ownershipCache: {[number]: {[string]: boolean}} = {}

function PassManager.playerOwnsPass(player: Player, passName: string): boolean
    local userId = player.UserId
    if not ownershipCache[userId] then
        ownershipCache[userId] = {}
    end

    if ownershipCache[userId][passName] == nil then
        local passId = PASS_IDS[passName]
        if not passId then
            warn("[PassManager] Unknown pass:", passName)
            return false
        end
        local success, owns = pcall(MarketplaceService.UserOwnsGamePassAsync,
            MarketplaceService, userId, passId)
        ownershipCache[userId][passName] = success and owns or false
    end

    return ownershipCache[userId][passName]
end

-- Prompt purchase from client via RemoteEvent
function PassManager.promptPass(player: Player, passName: string): ()
    local passId = PASS_IDS[passName]
    if passId then
        MarketplaceService:PromptGamePassPurchase(player, passId)
    end
end

-- Wire purchase completion — update cache and apply benefits
function PassManager.init(): ()
    MarketplaceService.PromptGamePassPurchaseFinished:Connect(
        function(player: Player, passId: number, wasPurchased: boolean)
            if not wasPurchased then return end
            -- Invalidate cache so next check re-fetches
            if ownershipCache[player.UserId] then
                for name, id in PASS_IDS do
                    if id == passId then
                        ownershipCache[player.UserId][name] = true
                    end
                end
            end
            -- Apply immediate benefit
            applyPassBenefit(player, passId)
        end
    )
end

return PassManager
```

### 每日奖励制度
```lua
-- ServerStorage/Modules/DailyRewardSystem.lua
local DataStoreService = game:GetService("DataStoreService")

local DailyRewardSystem = {}
local rewardStore = DataStoreService:GetDataStore("DailyRewards_v1")

-- Reward ladder — index = day streak
local REWARD_LADDER = {
    {coins = 50,  item = nil},        -- Day 1
    {coins = 75,  item = nil},        -- Day 2
    {coins = 100, item = nil},        -- Day 3
    {coins = 150, item = nil},        -- Day 4
    {coins = 200, item = nil},        -- Day 5
    {coins = 300, item = nil},        -- Day 6
    {coins = 500, item = "badge_7day"}, -- Day 7 — week streak bonus
}

local SECONDS_IN_DAY = 86400

function DailyRewardSystem.claimReward(player: Player): (boolean, any)
    local key = "daily_" .. player.UserId
    local success, data = pcall(rewardStore.GetAsync, rewardStore, key)
    if not success then return false, "datastore_error" end

    data = data or {lastClaim = 0, streak = 0}
    local now = os.time()
    local elapsed = now - data.lastClaim

    -- Already claimed today
    if elapsed < SECONDS_IN_DAY then
        return false, "already_claimed"
    end

    -- Streak broken if > 48 hours since last claim
    if elapsed > SECONDS_IN_DAY * 2 then
        data.streak = 0
    end

    data.streak = (data.streak % #REWARD_LADDER) + 1
    data.lastClaim = now

    local reward = REWARD_LADDER[data.streak]

    -- Save updated streak
    local saveSuccess = pcall(rewardStore.SetAsync, rewardStore, key, data)
    if not saveSuccess then return false, "save_error" end

    return true, reward
end

return DailyRewardSystem
```

### 入职流程设计文档
```markdown

### Roblox 体验入门流程

### 第 1 阶段：前 60 秒（保留至关重要）
目标：玩家执行核心动词并成功一次

步骤：
1. 生成一个视觉上独特的“起始区”——而不是主世界
2.即时可控时刻：无过场，无长教程对话
3. 保证首次成功——此阶段不可能失败
4.第一次成功时的视觉奖励（闪光/五彩纸屑）+音频反馈
5. 箭头或突出显示“第一个任务”NPC 或目标

### 第 2 阶段：前 5 分钟（核心循环介绍）
目标：玩家完成一个完整的核心循环并获得第一个奖励

步骤：
1.任务简单：目标明确，地点明显，机械师单一
2.奖励：足够的起始币，让自己感觉有意义
3.解锁一项额外功能或领域——创造前进动力
4.社交软提示：“邀请好友双倍奖励”（不屏蔽）

### 第 3 阶段：前 15 分钟（投资挂钩）
目标：玩家有足够的投入，退出感觉就像是一种损失

步骤：
1. 首次升级或等级提升
2. 个性化时刻：选择化妆品或命名角色
3.预览锁定功能：“达到5级解锁[X]”
4.自然收藏提示：“享受这次体验吗？将其添加到您的收藏夹！”

### 下车恢复点
- 2 分钟前离开的玩家：入职太慢 - 削减前 30 秒
- 5-7分钟后离开的玩家：第一个奖励不够引人注目——增加
- 15分钟后离开的玩家：核心循环很有趣，但没有返回的钩子——添加每日奖励提示
```

### 保留指标跟踪（通过 DataStore + Analytics）
```lua
-- Log key player events for retention analysis
-- Use AnalyticsService (Roblox's built-in, no third-party required)
local AnalyticsService = game:GetService("AnalyticsService")

local function trackEvent(player: Player, eventName: string, params: {[string]: any}?)
    -- Roblox's built-in analytics — visible in Creator Dashboard
    AnalyticsService:LogCustomEvent(player, eventName, params or {})
end

-- Track onboarding completion
trackEvent(player, "OnboardingCompleted", {time_seconds = elapsedTime})

-- Track first purchase
trackEvent(player, "FirstPurchase", {pass_name = passName, price_robux = price})

-- Track session length on leave
Players.PlayerRemoving:Connect(function(player)
    local sessionLength = os.time() - sessionStartTimes[player.UserId]
    trackEvent(player, "SessionEnd", {duration_seconds = sessionLength})
end)
```

### 高级能力

### 基于事件的实时操作
- 使用服务器重启时交换的 `ReplicatedStorage` 配置对象设计实时活动（限时内容、季节性更新）
- 构建一个倒计时系统，从单个服务器时间源驱动 UI、世界装饰和可解锁内容
- 实施软启动：使用针对配置标志的 `math.random()` 种子检查将新内容部署到一定比例的服务器
- 设计活动奖励结构，既能创造 FOMO，又不会造成掠夺性：具有明确盈利路径的有限化妆品，而不是付费墙

### 高级 Roblox 分析
- 使用 `AnalyticsService:LogCustomEvent()` 构建漏斗分析：跟踪入职、购买流程和保留触发器的每一步
- 实施会话记录元数据：首次加入时间戳、总播放时间、上次登录 — 存储在 DataStore 中用于群组分析
- 设计 A/B 测试基础设施：通过从 UserId 播种的 `math.random()` 将玩家分配到存储桶，记录哪个存储桶收到哪个变体
- 通过 `HttpService:PostAsync()` 将分析事件导出到外部后端，以获得 Roblox 原生仪表板之外的高级 BI 工具

### 社会和社区系统
- 使用 `Players:GetFriendsAsync()` 实施有奖励的朋友邀请，以验证友谊并授予推荐奖金
- 使用 `Players:GetRankInGroup()` 构建群组门控内容以进行 Roblox Group 集成
- 设计社交证明系统：显示实时在线玩家数量、最近玩家成就以及大厅中的排行榜位置
- 在适当的情况下实施 Roblox 语音聊天集成：使用 `VoiceChatService` 实现社交/RP 体验的空间语音

### 货币化优化
- 实施软货币首次购买渠道：为新玩家提供足够的货币进行小额购买，以降低首次购买门槛
- 设计价格锚定：在标准选项旁边显示高级选项 - 相比之下，标准选项显得实惠
- 建立购买放弃恢复：如果玩家打开商店但没有购买，则在下一次会话时显示提醒通知
- 使用分析桶系统进行 A/B 测试价格点：测量每个价格变量的转化率、ARPU 和 LTV
