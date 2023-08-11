
import esbuild from 'rollup-plugin-esbuild'
import json from '@rollup/plugin-json'
export default [
    {
        input: 'bin/main.ts',
        plugins: [
            json({
                namedExports: false
            }),
           // typescript(), // typescript 转义
            esbuild({
                sourceMap: true,
                minify: false,
                target: 'es6'
            }),

        ],
        output: [
            { file: 'dist/index.js', format: 'es',   banner: '#!/usr/bin/env node', }
        ]
    }
];
