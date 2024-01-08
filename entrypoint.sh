#!/bin/sh

export USER=$(whoami)

chmod o+w /dev/stdout
rm /tmp/sls/sls_server.pid
/usr/bin/supervisord --nodaemon --configuration /etc/supervisord.conf
