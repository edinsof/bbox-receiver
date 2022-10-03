#!/bin/bash

export USER=$(whoami)

chmod o+w /dev/stdout
sudo -E /usr/bin/supervisord --nodaemon --configuration /etc/supervisord.conf