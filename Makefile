#!/usr/bin/env bash

build:
	@make dep
	@cd packages/core && npm run build
	@cd packages/webapp && npm run build
	@cd packages/webservice && npm run build
	@rm -rf build && ncc build packages/webservice/lib/index.js -o build && cp -r packages/webapp/dist build/public && cp -r packages/webservice/playground build

build-blocklet:
	@make dep
	@cd packages/core && npm run build
	@cd packages/webapp && npm run build:blocklet
	@cd packages/webservice && npm run build:blocklet

build-blocklet-be:
	@make dep
	@cd packages/core && npm run build
	@cd packages/webservice && npm run build:blocklet

dep:
	@echo "Install dependencies required for this repo..."
	@yarn install
	@cd packages/types && npm run build
