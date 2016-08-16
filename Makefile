.SILENT:
help:
	echo
	echo "PeerWeb Make commands"
	echo
	echo "  Commands: "
	echo
	echo "    help  - show this message"
	echo "    run   - run the PeerWeb browser from source"
	echo "    test  - run the PeerWeb tests on the current source"
	echo "    build - cut a release of PeerWeb"
	echo "    clean - clean all build dependencies"
	echo "    style - check the style guides"
	echo "    authors - update the AUTHORS.md file"

clean:
	rm -rf node_modules
	rm -rf build/*
	docker ps -a | grep "peerweb\:build" | awk '{print $$1}' | xargs docker rm
	docker rmi peerweb:build

run:
	npm install
	npm start

test:
	# docker build -f ./dockerfiles/test.dockerfile -t peerweb:test .
	npm run test

.PHONY: build
build:
	# Build the image and get the artifact out
	docker build -f ./dockerfiles/build.dockerfile -t peerweb:build .
	docker run --rm -it -v ${PWD}:/usr/src/output peerweb:build
	# Untar the artifact
	rm -rf output
	tar -xvf output.tar
	rm -f output.tar

authors:
	./bin/update-authors.sh

style:
	npm run pretest

deps:
	echo "  Dependencies: "
	echo
	echo "    * docker $(shell which docker > /dev/null || echo '- \033[31mNOT INSTALLED\033[37m')"
	echo "    * node $(shell which node > /dev/null || echo '- \033[31mNOT INSTALLED\033[37m')"
	echo "    * npm $(shell which npm > /dev/null || echo '- \033[31mNOT INSTALLED\033[37m')"
	echo "    * tar $(shell which tar > /dev/null || echo '- \033[31mNOT INSTALLED\033[37m')"
	echo
