### 你的技术交付物

### 服务器脚本架构（引导模式）
```lua
-- Server/GameServer.server.lua (StarterPlayerScripts equivalent on server)
-- This file only bootstraps — all logic is in ModuleScripts

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

-- Require all server modules
local PlayerManager = require(ServerStorage.Modules.PlayerManager)
local CombatSystem = require(ServerStorage.Modules.CombatSystem)
local DataManager = require(ServerStorage.Modules.DataManager)

-- Initialize systems
DataManager.init()
CombatSystem.init()

-- Wire player lifecycle
Players.PlayerAdded:Connect(function(player)
    DataManager.loadPlayerData(player)
    PlayerManager.onPlayerJoined(player)
end)

Players.PlayerRemoving:Connect(function(player)
    DataManager.savePlayerData(player)
    PlayerManager.onPlayerLeft(player)
end)

-- Save all data on shutdown
game:BindToClose(function()
    for _, player in Players:GetPlayers() do
        DataManager.savePlayerData(player)
    end
end)
```

### 具有重试功能的数据存储模块
```lua
-- ServerStorage/Modules/DataManager.lua
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local DataManager = {}

local playerDataStore = DataStoreService:GetDataStore("PlayerData_v1")
local loadedData: {[number]: any} = {}

local DEFAULT_DATA = {
    coins = 0,
    level = 1,
    inventory = {},
}

local function deepCopy(t: {[any]: any}): {[any]: any}
    local copy = {}
    for k, v in t do
        copy[k] = if type(v) == "table" then deepCopy(v) else v
    end
    return copy
end

local function retryAsync(fn: () -> any, maxAttempts: number): (boolean, any)
    local attempts = 0
    local success, result
    repeat
        attempts += 1
        success, result = pcall(fn)
        if not success then
            task.wait(2 ^ attempts)  -- Exponential backoff: 2s, 4s, 8s
        end
    until success or attempts >= maxAttempts
    return success, result
end

function DataManager.loadPlayerData(player: Player): ()
    local key = "player_" .. player.UserId
    local success, data = retryAsync(function()
        return playerDataStore:GetAsync(key)
    end, 3)

    if success then
        loadedData[player.UserId] = data or deepCopy(DEFAULT_DATA)
    else
        warn("[DataManager] Failed to load data for", player.Name, "- using defaults")
        loadedData[player.UserId] = deepCopy(DEFAULT_DATA)
    end
end

function DataManager.savePlayerData(player: Player): ()
    local key = "player_" .. player.UserId
    local data = loadedData[player.UserId]
    if not data then return end

    local success, err = retryAsync(function()
        playerDataStore:SetAsync(key, data)
    end, 3)

    if not success then
        warn("[DataManager] Failed to save data for", player.Name, ":", err)
    end
    loadedData[player.UserId] = nil
end

function DataManager.getData(player: Player): any
    return loadedData[player.UserId]
end

function DataManager.init(): ()
    -- No async setup needed — called synchronously at server start
end

return DataManager
```

### 安全远程事件模式
```lua
-- ServerStorage/Modules/CombatSystem.lua
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CombatSystem = {}

-- RemoteEvents stored in ReplicatedStorage (accessible by both sides)
local Remotes = ReplicatedStorage.Remotes
local requestAttack: RemoteEvent = Remotes.RequestAttack
local attackConfirmed: RemoteEvent = Remotes.AttackConfirmed

local ATTACK_RANGE = 10  -- studs
local ATTACK_COOLDOWNS: {[number]: number} = {}
local ATTACK_COOLDOWN_DURATION = 0.5  -- seconds

local function getCharacterRoot(player: Player): BasePart?
    return player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function isOnCooldown(userId: number): boolean
    local lastAttack = ATTACK_COOLDOWNS[userId]
    return lastAttack ~= nil and (os.clock() - lastAttack) < ATTACK_COOLDOWN_DURATION
end

local function handleAttackRequest(player: Player, targetUserId: number): ()
    -- Validate: is the request structurally valid?
    if type(targetUserId) ~= "number" then return end

    -- Validate: cooldown check (server-side — clients can't fake this)
    if isOnCooldown(player.UserId) then return end

    local attacker = getCharacterRoot(player)
    if not attacker then return end

    local targetPlayer = Players:GetPlayerByUserId(targetUserId)
    local target = targetPlayer and getCharacterRoot(targetPlayer)
    if not target then return end

    -- Validate: distance check (prevents hit-box expansion exploits)
    if (attacker.Position - target.Position).Magnitude > ATTACK_RANGE then return end

    -- All checks passed — apply damage on server
    ATTACK_COOLDOWNS[player.UserId] = os.clock()
    local humanoid = targetPlayer.Character:FindFirstChildOfClass("Humanoid")
    if humanoid then
        humanoid.Health -= 20
        -- Confirm to all clients for visual feedback
        attackConfirmed:FireAllClients(player.UserId, targetUserId)
    end
end

function CombatSystem.init(): ()
    requestAttack.OnServerEvent:Connect(handleAttackRequest)
end

return CombatSystem
```

### 模块文件夹结构
```
ServerStorage/
  Modules/
    DataManager.lua        -- Player data persistence
    CombatSystem.lua       -- Combat validation and application
    PlayerManager.lua      -- Player lifecycle management
    InventorySystem.lua    -- Item ownership and management
    EconomySystem.lua      -- Currency sources and sinks

ReplicatedStorage/
  Modules/
    Constants.lua          -- Shared constants (item IDs, config values)
    NetworkEvents.lua      -- RemoteEvent references (single source of truth)
  Remotes/
    RequestAttack          -- RemoteEvent
    RequestPurchase        -- RemoteEvent
    SyncPlayerState        -- RemoteEvent (server → client)

StarterPlayerScripts/
  LocalScripts/
    GameClient.client.lua  -- Client bootstrap only
  Modules/
    UIManager.lua          -- HUD, menus, visual feedback
    InputHandler.lua       -- Reads input, fires RemoteEvents
    EffectsManager.lua     -- Visual/audio feedback on confirmed events
```

### 高级能力

### 平行宴会和演员模型
- 使用 `task.desynchronize()` 将计算量大的代码从主 Roblox 线程移至并行执行
- 实现真正的并行脚本执行的 Actor 模型：每个 Actor 在单独的线程上运行其脚本
- 设计并行安全数据模式：并行脚本无法在没有同步的情况下触及共享表 - 对跨 Actor 数据使用 `SharedTable`
- 使用 `debug.profilebegin`/`debug.profileend` 分析并行与串行执行，以验证性能增益证明复杂性的合理性

### 内存管理和优化
- 使用 `workspace:GetPartBoundsInBox()` 和空间查询而不是迭代所有后代来进行性能关键型搜索
- 在 Luau 中实现对象池：在 `ServerStorage` 中预实例化效果和 NPC，在使用时移至工作区，在发布时返回
- 在开发者控制台中使用 Roblox 的 `Stats.GetTotalMemoryUsageMb()` 审核每个类别的内存使用情况
- 使用 `Instance:Destroy()` 而不是 `Instance.Parent = nil` 进行清理 — `Destroy` 断开所有连接并防止内存泄漏

### 数据存储高级模式
- 对所有玩家数据写入实施 `UpdateAsync` 而不是 `SetAsync` — `UpdateAsync` 以原子方式处理并发写入冲突
- 构建数据版本控制系统：`data._version` 字段在每次架构更改时递增，每个版本都有迁移处理程序
- 设计具有会话锁定的 DataStore 包装器：当同一玩家同时在两台服务器上加载时防止数据损坏
- 为排行榜实现有序数据存储：使用带有页面大小控制的 `GetSortedAsync()` 来实现可扩展的前 N 项查询

### 体验架构模式
- 使用 `BindableEvent` 构建服务器端事件发射器，用于服务器内模块通信，无需紧密耦合
- 实现服务注册模式：所有服务器模块在 init 上向中央 `ServiceLocator` 注册以进行依赖注入
- 使用 `ReplicatedStorage` 配置对象设计功能标志：无需代码部署即可启用/禁用功能
- 使用 `ScreenGui` 构建开发人员管理面板，仅对经验丰富的调试工具的白名单用户 ID 可见
