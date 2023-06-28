import typescript from 'rollup-plugin-typescript2'; // 处理typescript
import babel from '@rollup/plugin-babel';
import esbuild from 'rollup-plugin-esbuild'
import json from '@rollup/plugin-json'
export default [
    {
        input: 'src/index.ts',
        plugins: [
            json({
                namedExports: false
            }),
           // typescript(), // typescript 转义
            esbuild({
                sourceMap: true,
                minify: false,
                target: 'es2015'
            }),
/*            babel({
                babelrc: false,
                presets: [['@babel/preset-env', { modules: false, loose: true }]],
                plugins: [['@babel/plugin-proposal-class-properties', { loose: true }]],
                exclude: 'node_modules/!**',
            })*/
        ],
        output: [
            { file: 'dist/index.js', format: 'cjs' },
            { file: 'dist/index.esm.js', format: 'es' }
        ]
    }
];
