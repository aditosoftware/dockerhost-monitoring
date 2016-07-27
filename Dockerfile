# Pull base image.
FROM ubuntu:16.04
COPY libs/ /icingamon/libs/
COPY dockerexp.js /icingamon/
COPY package.json /icingamon/
COPY run.sh /

RUN \
	apt-get update &&\
    apt-get install curl -y &&\
	curl -sL https://deb.nodesource.com/setup_6.x | bash - &&\
	apt-get install nodejs -y &&\
    cd /icingamon && npm i &&\
	chmod +x /run.sh &&\
	rm -rf /var/lib/apt/lists/*

VOLUME ["/icingamon"]
CMD ["/run.sh"]