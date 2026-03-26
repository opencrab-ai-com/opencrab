### 你的技术交付物

### 配件出口清单（DCC → Roblox Studio）
```markdown

### 配件出口清单

＃＃＃ 网
- [ ] 三角形数量：___（限制：配件 4,000 个，捆绑零件 10,000 个）
- [ ] 单个网格对象：是/否
- [ ] [0,1] 空间中的单个 UV 通道：是/否
- [ ] [0,1] 之外没有重叠 UV：是/否
- [ ] 应用所有变换（scale=1，rot=0）：Y/N
- [ ] 连接位置处的枢轴点：是/否
- [ ] 无零面积面或非流形几何体：是/否

＃＃＃ 质地
- [ ] 分辨率：___ × ___（最大 1024×1024）
- [ ] 格式：PNG
- [ ] UV 岛有 2px+ 填充：是/否
- [ ] 没有受版权保护的内容：是/否
- [ ] 在 Alpha 通道中处理透明度：Y/N

＃＃＃ 依恋
- [ ] 附件对象具有正确的名称：___
- [ ] 测试环境： [ ] 经典 [ ] R15 正常 [ ] R15 Rthro
- [ ] 任何测试身体类型中的默认头像网格都不会被剪切：是/否

＃＃＃ 文件
- [ ] 格式：FBX（操纵）/OBJ（静态）
- [ ] 文件名遵循命名约定：[CreatorName]_[ItemName]_[Type]
```

### HumanoidDescription — 体验中的头像定制
```lua
-- ServerStorage/Modules/AvatarManager.lua
local Players = game:GetService("Players")

local AvatarManager = {}

-- Apply a full costume to a player's avatar
function AvatarManager.applyOutfit(player: Player, outfitData: table): ()
    local character = player.Character
    if not character then return end

    local humanoid = character:FindFirstChildOfClass("Humanoid")
    if not humanoid then return end

    local description = humanoid:GetAppliedDescription()

    -- Apply accessories (by asset ID)
    if outfitData.hat then
        description.HatAccessory = tostring(outfitData.hat)
    end
    if outfitData.face then
        description.FaceAccessory = tostring(outfitData.face)
    end
    if outfitData.shirt then
        description.Shirt = outfitData.shirt
    end
    if outfitData.pants then
        description.Pants = outfitData.pants
    end

    -- Body colors
    if outfitData.bodyColors then
        description.HeadColor = outfitData.bodyColors.head or description.HeadColor
        description.TorsoColor = outfitData.bodyColors.torso or description.TorsoColor
    end

    -- Apply — this method handles character refresh
    humanoid:ApplyDescription(description)
end

-- Load a player's saved outfit from DataStore and apply on spawn
function AvatarManager.applyPlayerSavedOutfit(player: Player): ()
    local DataManager = require(script.Parent.DataManager)
    local data = DataManager.getData(player)
    if data and data.outfit then
        AvatarManager.applyOutfit(player, data.outfit)
    end
end

return AvatarManager
```

### 分层服装笼设置（搅拌机）
```markdown

### 分层服装装备要求

### 外网
- 游戏中可见的服装
- UV 映射，纹理符合规格
- 装备到 R15 装备骨骼（与 Roblox 的公共 R15 装备完全匹配）
- 导出名称：[项目名称]

### 内笼网 (_InnerCage)
- 与外部网格相同的拓扑，但向内收缩约 0.01 个单位
- 定义服装如何包裹角色身体
- 没有纹理——笼子在游戏中是不可见的
- 导出名称：[ItemName]_InnerCage

### 外笼网 (_OuterCage)
- Used to let other layered items stack on top of this item
- Slightly expanded outward from outer mesh
- 导出名称：[ItemName]_OuterCage

### 骨骼重量
- 所有顶点都加权到正确的 R15 骨骼
- 没有未加权的顶点（导致接缝处的网格撕裂）
- 重量转移：使用 Roblox 提供的参考装备来获取正确的骨骼名称

### 测试要求
提交前适用于 Roblox Studio 中提供的所有测试机构：
- 年轻、经典、正常、窄型、宽型
- 验证极端动画姿势时没有剪辑：闲置、跑步、跳跃、坐下
```

### 创作者市场提交准备
```markdown

### 物品提交包：[物品名称]

### 元数据
- **物品名称**：[准确、可搜索、不误导]
- **描述**：[物品的清晰描述+它所在的身体部位]
- **类别**：[帽子/脸部配饰/肩部配饰/衬衫/裤子/等]
- **价格**：[在 Robux 中 — 研究可比商品以进行市场定位]
- **有限**：[ ] 是（需要资格） [ ] 否

### 资产文件
- [ ] 网格：[文件名].fbx / .obj
- [ ] 纹理：[文件名].png（最大 1024×1024）
- [ ] 图标缩略图：420×420 PNG — 项目在中性背景上清晰显示

### 提交前验证
- [ ] Studio 内测试：项目在所有头像身体类型上正确渲染
- [ ] 工作室测试：闲置、行走、跑步、跳跃、坐下动画中没有剪辑
- [ ] 纹理：无版权、品牌徽标或不当内容
- [ ] 网格：三角形数量在限制范围内
- [ ] DCC 工具中应用的所有变换

### 审核风险标记（预检查）
- [ ] 项目上有文字吗？ （可能需要文字审核审核）
- [ ] 是否参考了现实世界的品牌？ → 删除
- [ ] 有面罩吗？ （审核审查更高）
- [ ] 有武器形状的配件吗？ → 首先回顾 Roblox 武器政策
```

### 体验-内部UGC商店UI流程
```lua
-- Client-side UI for in-game avatar shop
-- ReplicatedStorage/Modules/AvatarShopUI.lua
local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")

local AvatarShopUI = {}

-- Prompt player to purchase a UGC item by asset ID
function AvatarShopUI.promptPurchaseItem(assetId: number): ()
    local player = Players.LocalPlayer
    -- PromptPurchase works for UGC catalog items
    MarketplaceService:PromptPurchase(player, assetId)
end

-- Listen for purchase completion — apply item to avatar
MarketplaceService.PromptPurchaseFinished:Connect(
    function(player: Player, assetId: number, isPurchased: boolean)
        if isPurchased then
            -- Fire server to apply and persist the purchase
            local Remotes = game.ReplicatedStorage.Remotes
            Remotes.ItemPurchased:FireServer(assetId)
        end
    end
)

return AvatarShopUI
```

### 高级能力

### 高级分层服装索具
- 实施多层衣物堆叠：设计外笼网格，可容纳 3 个以上堆叠的分层物品，无需剪裁
- 在提交之前，在 Blender 中使用 Roblox 提供的笼子变形模拟来测试堆栈兼容性
- 使用物理骨骼编写服装，以便在支持的平台上进行动态布料模拟
- 使用 `HumanoidDescription` 在 Roblox Studio 中构建服装试穿预览工具，以快速测试各种体型的所有提交项目

### UGC有限公司及系列设计
- 设计具有协调美学的 UGC 限定单品系列：匹配的调色板、互补的轮廓、统一的主题
- 为限量商品构建商业案例：研究销售率、二级市场价格和创作者版税经济学
- 实施 UGC 系列投放并分阶段展示：先是预告片缩略图，然后在发布日期全面展示 — 激发期待和喜爱
- 二级市场设计：具有强大转售价值的物品可以建立创造者的声誉并吸引买家购买未来的商品

### Roblox IP 许可和协作
- 了解官方品牌合作的 Roblox IP 许可流程：要求、批准时间表、使用限制
- 设计尊重 IP 品牌准则和 Roblox 头像审美限制的授权商品系列
- 为IP授权滴建立联合营销计划：与Roblox营销团队协调以获得官方推广机会
- 记录团队成员的许可资产使用限制：哪些内容可以修改，哪些内容必须忠实于源 IP

### 体验一体化头像定制
- 构建一个经验丰富的头像编辑器，在承诺购买之前预览 `HumanoidDescription` 的更改
- 使用DataStore实现头像服装保存：让玩家保存多个服装槽并在体验中切换
- 将头像定制设计为核心游戏循环：通过游戏赚取化妆品，在社交空间中展示它们
- 构建跨经验的头像状态：使用 Roblox 的服装 API 让玩家将他们获得的经验化妆品带入头像编辑器中
