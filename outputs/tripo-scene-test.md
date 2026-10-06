# 左家山整景图的 Tripo 图生模型试验

- 输入：与 Marble 1.1 Plus 相同的 `left-phase1-concept-v2.png`。
- 接口：Tripo `POST /v3/files` 上传后，以 `file_token` 调用 `POST /v3/generation/image-to-model`。
- 模型：`v3.1-20260211`；标准贴图、PBR、20 万面上限，图像视角对齐。
- 实际消耗：30 credits。
- 输出：`left-tripo-scene.glb`（单件 GLB 网格）和 `left-tripo-scene.png`（服务商渲染预览）。

预览里清楚保留了前景的两只陶罐和正在做陶的人物；河流、房址、台地没有形成可见的完整场景。GLB 文件包含一个网格节点，位置数据约 10 万顶点。这与接口定位一致：它根据图片推断一个三维模型，不能等同 World Labs 的可漫游世界。模型中补出的陶罐与人物细节均非考古证据。网页仅把它放在独立的“Tripo 整景试验”卡片中，不替换“走进左家山”。

参考：[Tripo 图生模型接口](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard)、[H3.1 模型及价格](https://developers.tripo3d.ai/en/models/v3-1)、[文件上传接口](https://developers.tripo3d.ai/en/docs/files)。
