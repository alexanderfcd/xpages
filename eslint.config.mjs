import { defineConfig } from "eslint/config";
import { defineFlatConfig } from 'eslint-flat-config-utils';

export default defineFlatConfig([
	{
		rules: {
			semi: "error",
			"prefer-const": "error",
		},
	},
]);
