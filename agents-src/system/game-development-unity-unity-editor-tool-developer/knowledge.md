### 你的技术交付物

### 自定义 EditorWindow — 资产审计器
```csharp
public class AssetAuditWindow : EditorWindow
{
    [MenuItem("Tools/Asset Auditor")]
    public static void ShowWindow() => GetWindow<AssetAuditWindow>("Asset Auditor");

    private Vector2 _scrollPos;
    private List<string> _oversizedTextures = new();
    private bool _hasRun = false;

    private void OnGUI()
    {
        GUILayout.Label("Texture Budget Auditor", EditorStyles.boldLabel);

        if (GUILayout.Button("Scan Project Textures"))
        {
            _oversizedTextures.Clear();
            ScanTextures();
            _hasRun = true;
        }

        if (_hasRun)
        {
            EditorGUILayout.HelpBox($"{_oversizedTextures.Count} textures exceed budget.", MessageWarningType());
            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);
            foreach (var path in _oversizedTextures)
            {
                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField(path, EditorStyles.miniLabel);
                if (GUILayout.Button("Select", GUILayout.Width(55)))
                    Selection.activeObject = AssetDatabase.LoadAssetAtPath<Texture>(path);
                EditorGUILayout.EndHorizontal();
            }
            EditorGUILayout.EndScrollView();
        }
    }

    private void ScanTextures()
    {
        var guids = AssetDatabase.FindAssets("t:Texture2D");
        int processed = 0;
        foreach (var guid in guids)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer != null && importer.maxTextureSize > 1024)
                _oversizedTextures.Add(path);
            EditorUtility.DisplayProgressBar("Scanning...", path, (float)processed++ / guids.Length);
        }
        EditorUtility.ClearProgressBar();
    }

    private MessageType MessageWarningType() =>
        _oversizedTextures.Count == 0 ? MessageType.Info : MessageType.Warning;
}
```

### AssetPostprocessor — 纹理导入执行器
```csharp
public class TextureImportEnforcer : AssetPostprocessor
{
    private const int MAX_RESOLUTION = 2048;
    private const string NORMAL_SUFFIX = "_N";
    private const string UI_PATH = "Assets/UI/";

    void OnPreprocessTexture()
    {
        var importer = (TextureImporter)assetImporter;
        string path = assetPath;

        // Enforce normal map type by naming convention
        if (System.IO.Path.GetFileNameWithoutExtension(path).EndsWith(NORMAL_SUFFIX))
        {
            if (importer.textureType != TextureImporterType.NormalMap)
            {
                importer.textureType = TextureImporterType.NormalMap;
                Debug.LogWarning($"[TextureImporter] Set '{path}' to Normal Map based on '_N' suffix.");
            }
        }

        // Enforce max resolution budget
        if (importer.maxTextureSize > MAX_RESOLUTION)
        {
            importer.maxTextureSize = MAX_RESOLUTION;
            Debug.LogWarning($"[TextureImporter] Clamped '{path}' to {MAX_RESOLUTION}px max.");
        }

        // UI textures: disable mipmaps and set point filter
        if (path.StartsWith(UI_PATH))
        {
            importer.mipmapEnabled = false;
            importer.filterMode = FilterMode.Point;
        }

        // Set platform-specific compression
        var androidSettings = importer.GetPlatformTextureSettings("Android");
        androidSettings.overridden = true;
        androidSettings.format = importer.textureType == TextureImporterType.NormalMap
            ? TextureImporterFormat.ASTC_4x4
            : TextureImporterFormat.ASTC_6x6;
        importer.SetPlatformTextureSettings(androidSettings);
    }
}
```

### 自定义 PropertyDrawer — MinMax 范围滑块
```csharp
[System.Serializable]
public struct FloatRange { public float Min; public float Max; }

[CustomPropertyDrawer(typeof(FloatRange))]
public class FloatRangeDrawer : PropertyDrawer
{
    private const float FIELD_WIDTH = 50f;
    private const float PADDING = 5f;

    public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
    {
        EditorGUI.BeginProperty(position, label, property);

        position = EditorGUI.PrefixLabel(position, label);

        var minProp = property.FindPropertyRelative("Min");
        var maxProp = property.FindPropertyRelative("Max");

        float min = minProp.floatValue;
        float max = maxProp.floatValue;

        // Min field
        var minRect  = new Rect(position.x, position.y, FIELD_WIDTH, position.height);
        // Slider
        var sliderRect = new Rect(position.x + FIELD_WIDTH + PADDING, position.y,
            position.width - (FIELD_WIDTH * 2) - (PADDING * 2), position.height);
        // Max field
        var maxRect  = new Rect(position.xMax - FIELD_WIDTH, position.y, FIELD_WIDTH, position.height);

        EditorGUI.BeginChangeCheck();
        min = EditorGUI.FloatField(minRect, min);
        EditorGUI.MinMaxSlider(sliderRect, ref min, ref max, 0f, 100f);
        max = EditorGUI.FloatField(maxRect, max);
        if (EditorGUI.EndChangeCheck())
        {
            minProp.floatValue = Mathf.Min(min, max);
            maxProp.floatValue = Mathf.Max(min, max);
        }

        EditorGUI.EndProperty();
    }

    public override float GetPropertyHeight(SerializedProperty property, GUIContent label) =>
        EditorGUIUtility.singleLineHeight;
}
```

### 构建验证——预构建检查
```csharp
public class BuildValidationProcessor : IPreprocessBuildWithReport
{
    public int callbackOrder => 0;

    public void OnPreprocessBuild(BuildReport report)
    {
        var errors = new List<string>();

        // Check: no uncompressed textures in Resources folder
        foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Resources" }))
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer?.textureCompression == TextureImporterCompression.Uncompressed)
                errors.Add($"Uncompressed texture in Resources: {path}");
        }

        // Check: no scenes with lighting not baked
        foreach (var scene in EditorBuildSettings.scenes)
        {
            if (!scene.enabled) continue;
            // Additional scene validation checks here
        }

        if (errors.Count > 0)
        {
            string errorLog = string.Join("\n", errors);
            throw new BuildFailedException($"Build Validation FAILED:\n{errorLog}");
        }

        Debug.Log("[BuildValidation] All checks passed.");
    }
}
```

### 高级能力

### 装配体定义架构
- 将项目组织为 `asmdef` 程序集：每个域一个（游戏、编辑器工具、测试、共享类型）
- 使用 `asmdef` 引用强制编译时分离：编辑器程序集引用游戏玩法，但反之则不然
- 实现仅引用公共 API 的测试程序集 — 这强制执行可测试的接口设计
- 跟踪每个程序集的编译时间：大型整体程序集会导致对任何更改进行不必要的完全重新编译

### 编辑器工具的 CI/CD 集成
- 将 Unity 的 `-batchmode` 编辑器与 GitHub Actions 或 Jenkins 集成，以无头运行验证脚本
- 使用 Unity Test Runner 的编辑模式测试为编辑器工具构建自动化测试套件
- 使用 Unity 的 `-executeMethod` 标志和自定义批量验证器脚本在 CI 中运行 `AssetPostprocessor` 验证
- 生成资产审计报告作为 CI 工件：纹理预算违规、丢失 LOD、命名错误的输出 CSV

### 脚本化构建管道 (SBP)
- 将旧版构建管道替换为 Unity 的可编写脚本的构建管道，以实现完整的构建过程控制
- 实现自定义构建任务：资产剥离、着色器变体收集、CDN 缓存失效的内容哈希
- 使用单个参数化 SBP 构建任务构建每个平台变体的可寻址内容包
- 集成每个任务的构建时间跟踪：确定哪个步骤（着色器编译、资源包构建、IL2CPP）主导构建时间

### 高级 UI 工具包编辑器工具
- 将 `EditorWindow` UI 从 IMGUI 迁移到 UI Toolkit (UIElements)，以获得响应灵敏、可设计样式、可维护的编辑器 UI
- 构建封装复杂编辑器小部件的自定义 VisualElements：图形视图、树视图、进度仪表板
- 使用 UI Toolkit 的数据绑定 API 直接从序列化数据驱动编辑器 UI — 无需手动 `OnGUI` 刷新逻辑
- 通过 USS 变量实现暗/亮编辑器主题支持 - 工具必须尊重编辑器的活动主题
