import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    input: 'src/ui/sidepanel.js',
    output: {
      file: 'dist/sidepanel.js',
      format: 'iife',
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true,
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: 'manifest.json',
            dest: 'dist',
          },
          {
            src: 'src/bg/background.js',
            dest: 'dist',
          },
          {
            src: 'src/ui/sidepanel.html',
            dest: 'dist',
          },
          {
            src: 'src/ui/sidepanel.css',
            dest: 'dist',
          },
          // Remove any reference to copying 'ui' folder
        ],
      }),
    ],
  },
];
