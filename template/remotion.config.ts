import { Config } from '@remotion/cli/config';
import path from 'path';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// 接入共享层 ../kit/:该共享层没有自己的 node_modules,跨仓 import 时
// kit 文件(在 ../kit,工程目录外)里的裸依赖需解析到本工程这一份。
// react/remotion 等顶层包靠 resolve.modules 兜底;但 webpack 实测:从 kit 目录 import
// scoped 包(@remotion/* / @react-three/* / 大包 three)时 resolve.modules【兜不到】
// → 必须显式 alias 到本工程入口文件(指【入口文件】require.resolve,非包目录)。
// 新增任何被 kit 镜头跨仓 import 的动画包(3D/anime/原生武器…),都加进这张表。
const CROSS_REPO_PKGS = [
  '@remotion/motion-blur',
  '@remotion/three',
  '@remotion/noise',
  '@remotion/paths',
  '@remotion/shapes',
  '@remotion/transitions',
  '@remotion/animation-utils',
  'three',
  '@react-three/fiber',
  'animejs',
];
const aliasEntries: Record<string, string> = {};
for (const pkg of CROSS_REPO_PKGS) {
  try {
    aliasEntries[pkg + '$'] = require.resolve(pkg, { paths: [__dirname] });
  } catch {
    // 本工程没装的包跳过
  }
}

Config.overrideWebpackConfig((config) => {
  const resolve = config.resolve ?? {};
  let alias = resolve.alias;
  if (Array.isArray(alias)) {
    alias = [
      ...alias,
      ...Object.entries(aliasEntries).map(([name, target]) => ({
        name: name.replace(/\$$/, ''),
        alias: target,
        onlyModule: true,
      })),
    ];
  } else {
    alias = { ...(alias as Record<string, string>), ...aliasEntries };
  }

  return {
    ...config,
    resolve: {
      ...resolve,
      modules: [
        path.resolve(__dirname, 'node_modules'),
        ...(resolve.modules || ['node_modules']),
      ],
      alias,
    },
  };
});
