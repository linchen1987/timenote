#!/usr/bin/env bash

build-all:
	@make dep
	@cd packages/core && npm run build
	@cd packages/webapp && npm run build
	@cd packages/webservice && npm run build
	@rm -rf build && ncc build packages/webservice/lib/index.js -o build && cp -r packages/webapp/dist build/public && cp -r packages/webservice/playground build

dep:
	@echo "Install dependencies required for this repo..."
	@yarn install
	@cd packages/types && npm run build
