#!/bin/bash

sed -i /chatbot/app.js -e "s/<Randomly_Generated_Token_To_Provide_To_Facebook>/"$VERIFY_TOKEN"/g"
sed -i /chatbot/app.js -e "s/<Token_Provided_By_Facebook>/"$PAGE_ACCESS_TOKEN"/g"
sed -i /chatbot/app.js -e "s/<Customer_demo_url>/http:\/\/"$SERVICE_URL"/g"
sed -i /chatbot/app.js -e "s/<Customer_Store>/"$SCOPE"/g"
sed -i /chatbot/app.js -e "s/https://s3-us-west-2.amazonaws.com/<link_to_images>\//https:\/\/"$S3_URL"/g"
sed -i /chatbot/app.js -e "s/<API_Key>/"$FIREBASE_API_KEY"/g"
sed -i /chatbot/app.js -e "s/<Auth_Domain>/"$FIREBASE_AUTH_DOMAIN"/g"
sed -i /chatbot/app.js -e "s/<App_Name>/"$FIREBASE_APP_NAME"/g"
sed -i /chatbot/app.js -e "s/<Database_Url>/https:\/\/"$FIREBASE_DB_URL"/g"
sed -i /chatbot/app.js -e "s/<AUTHENTICATION_LOGIN_URL>/"$SERVICE_URL"\/auth/g"
sed -i /chatbot/app.js -e "s/<Service_Account>/.\/credentials/g"
