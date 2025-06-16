#include <WiFi.h>
#include <SPI.h>
#include <SPIFFS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <Wire.h>
#include <RTClib.h>
#include <ESP32Servo.h>
#include "esp_system.h"

#define SDA_PIN    16
#define SCL_PIN    17
#define SERVO_PIN  18

// Calibrare unghiuri servo
const uint8_t REST_ANGLE =   0;
const uint8_t FEED_ANGLE =  90;

RTC_DS3231      rtc;
Servo           feeder;
AsyncWebServer  server(80);

// Scheduling
bool      scheduleActive  = false;
DateTime  nextFeed;
uint16_t  feedIntervalMin = 60;
uint8_t   feedCount       = 1;

// Flag pentru hrănire manuală
volatile bool feedRequested = false;

// Mișcare servo
void doFeed() {
  feeder.write(FEED_ANGLE);
  delay(400);
  feeder.write(REST_ANGLE);
}

// Endpoint /feed
void onFeedRequest(AsyncWebServerRequest *req) {
  feedRequested = true;
  req->send(200, "text/plain", "OK");
}

void setup() {
  Serial.begin(115200);
  delay(200);

  // RTC
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!rtc.begin()) {
    Serial.println("‼ RTC not found!");
  }

  // Servo
  feeder.attach(SERVO_PIN);
  feeder.write(REST_ANGLE);

  // 1) Pornește SoftAP
  WiFi.mode(WIFI_AP);
  WiFi.softAP("FishFeeder-Setup");
  Serial.print("AP SSID: FishFeeder-Setup  →  ");
  Serial.println(WiFi.softAPIP());  // de obicei 192.168.4.1

  // 2) Montează SPIFFS și servește pagina
  SPIFFS.begin(true);
  Serial.println("Conținut SPIFFS:");
File root = SPIFFS.open("/");
File file = root.openNextFile();
while(file){
  Serial.println(" - " + String(file.name()));
  file = root.openNextFile();
}

  server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");

  // 3) Endpoint-uri pentru feed și program
  server.on("/feed", HTTP_ANY, onFeedRequest);
  server.on("/setSchedule", HTTP_GET, [](AsyncWebServerRequest *req){
    if (!req->hasParam("time") ||
        !req->hasParam("interval") ||
        !req->hasParam("count")) {
      return req->send(400, "text/plain", "Parametri lipsă");
    }
    String t = req->getParam("time")->value();
    feedIntervalMin = req->getParam("interval")->value().toInt();
    feedCount       = req->getParam("count")->value().toInt();
    int p = t.indexOf(':');
    int h = t.substring(0, p).toInt();
    int m = t.substring(p+1).toInt();
    DateTime now = rtc.now();
    nextFeed = DateTime(now.year(), now.month(), now.day(), h, m, 0);
    if (nextFeed.unixtime() <= now.unixtime())
      nextFeed = nextFeed + TimeSpan(1,0,0,0);
    scheduleActive = true;
    req->send(200, "text/plain", "Scheduled");
  });
  server.on("/stopSchedule", HTTP_GET, [](AsyncWebServerRequest *req){
    scheduleActive = false;
    req->send(200, "text/plain", "Stopped");
  });

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  if (feedRequested) {
    feedRequested = false;
    for (uint8_t i=0; i<feedCount; i++) {
      doFeed();
      if (i+1<feedCount) delay(200);
    }
  }
  if (scheduleActive) {
    DateTime now = rtc.now();
    if (now.unixtime() >= nextFeed.unixtime()) {
      for (uint8_t i=0; i<feedCount; i++) {
        doFeed();
        if (i+1<feedCount) delay(200);
      }
      nextFeed = nextFeed + TimeSpan(0, feedIntervalMin, 0, 0);
    }
  }
  delay(50);
}
