#!/bin/bash

sed -i /chatlogin/src/ep.config.json -e "s/\"scope\": \"vestri\"/\"scope\": \"$SCOPE\"/g"
sed -i /chatlogin/src/ep.config.json -e "s/\"pathForProxy\": \"http:\/\/localhost:9080\"/\"pathForProxy\": \"http:\/\/$CORTEX_URL\"/g"

