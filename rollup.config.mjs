// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';

export default {
	input: 'main.js',
	output: {
		file: 'bundle.js',
		format: 'es'
	},
	plugins: [resolve()]
};