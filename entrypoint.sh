#!/bin/bash

export USER=$(whoami)

chmod o+w /dev/stdout
/usr/bin/supervisord --nodaemon --configuration /etc/supervisord.conf