#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_NAME";         // ชื่อ WiFi
const char* password = "YOUR_WIFI_PASSWORD"; // รหัส WiFi
const char* mqtt_server = "broker.emqx.io";

// --- URL ของ Google App Script ---
const String googleScriptURL = "YOUR_GOOGLE_SCRIPT_URL";

// --- Telegram Bot Token & Chat ID ---
const String botToken = "YOUR_BOT_TOKEN"; 
const String chatId = "YOUR_CHAT_ID";

WiFiClient espClient;
PubSubClient client(espClient);

#define DHTPIN 4
#define DHTTYPE DHT22
#define IR_PIN 14
#define SOUND_PIN 34
#define BUZZER_PIN 12
#define FAN_PIN 25
#define LED_WHITE_1 13
#define LED_RED_2 27
#define LED_RED_4 26
#define LED_ALERT 32

// OLED SPI
#define OLED_SCLK 18
#define OLED_SDA  23
#define OLED_DC   16
#define OLED_CS    5
#define OLED_RES  17
Adafruit_SSD1306 display(128, 64, OLED_SDA, OLED_SCLK, OLED_DC, OLED_RES, OLED_CS);

DHT dht(DHTPIN, DHTTYPE);

bool isSecurityOn = false;
bool soundActiveMode = false;

// --- ฟังก์ชันส่งข้อมูลเข้า Google Sheets ---
void sendToGoogleSheet(String event) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = googleScriptURL + "?event=" + event;
    http.begin(url);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); 
    int httpCode = http.GET();
    if (httpCode > 0) {
      Serial.print("Data Sent to Sheet: ");
      Serial.println(event);
    } else {
      Serial.print("Error sending to Sheet: ");
      Serial.println(httpCode);
    }
    http.end();
  }
}

void sendTelegram(String message) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "https://api.telegram.org/bot" + botToken + "/sendMessage?chat_id=" + chatId + "&text=" + message;
    http.begin(url);
    http.GET();
    http.end();
  }
}

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) { msg += (char)payload[i]; }
  String topicStr = String(topic);
  String logMsg = "Command: ";

  if (topicStr == "home/led1") {
    digitalWrite(LED_WHITE_1, msg == "ON" ? HIGH : LOW);
    logMsg += "Door Light " + msg;
    sendToGoogleSheet("DOOR_LIGHT_" + msg);
  }
  else if (topicStr == "home/led2") {
    digitalWrite(LED_RED_2, msg == "ON" ? HIGH : LOW);
    logMsg += "Left Light " + msg;
    sendToGoogleSheet("LEFT_LIGHT_" + msg);
  }
  else if (topicStr == "home/led3") {
    digitalWrite(LED_RED_4, msg == "ON" ? HIGH : LOW);
    logMsg += "Right Light " + msg;
    sendToGoogleSheet("RIGHT_LIGHT_" + msg);
  }
  else if (topicStr == "home/led4") {
    digitalWrite(LED_ALERT, msg == "ON" ? HIGH : LOW);
    logMsg += "Alert Light " + msg;
    sendToGoogleSheet("ALERT_LIGHT_" + msg);
  }
  else if (topicStr == "home/fan") {
    digitalWrite(FAN_PIN, msg == "ON" ? HIGH : LOW);
    logMsg += "Fan " + msg;
    sendToGoogleSheet("FAN_" + msg);
  }
  else if (topicStr == "home/security_mode") {
    isSecurityOn = (msg == "ON");
    logMsg += "Security Mode " + msg;
    sendToGoogleSheet("SECURITY_MODE_" + msg);
  }
  sendTelegram(logMsg);
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP32_SmartHome_Ploy")) {
      client.subscribe("home/led1");
      client.subscribe("home/led2");
      client.subscribe("home/led3");
      client.subscribe("home/led4");
      client.subscribe("home/fan");
      client.subscribe("home/security_mode");
      client.subscribe("home/sound_sensor");
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_WHITE_1, OUTPUT);
  pinMode(LED_RED_2, OUTPUT);
  pinMode(LED_RED_4, OUTPUT);
  pinMode(LED_ALERT, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(IR_PIN, INPUT);
  pinMode(SOUND_PIN, INPUT);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  
  dht.begin();
  if(!display.begin(SSD1306_SWITCHCAPVCC)) { Serial.println("OLED failed"); }
  display.clearDisplay();
  display.setTextColor(WHITE);
}

bool lightState = LOW;
unsigned long lastClapTime = 0;


void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  int isDoorOpen = digitalRead(IR_PIN); 
  int soundVal = analogRead(SOUND_PIN);
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  
  // --- 1. ฟังชันควบคุมพัดลมอัตโนมัติตามอุณหภูมิ (Auto Fan) ---
  static bool autoFanActive = false;
  if (!isnan(t)) { // เช็กว่าเซนเซอร์อ่านค่าได้ปกติ
    if (t >= 35.0 && !autoFanActive) {
      digitalWrite(FAN_PIN, HIGH);
      autoFanActive = true;
      client.publish("home/fan", "ON");
      sendTelegram("🌡️ อุณหภูมิสูง (" + String(t) + "°C): เปิดพัดลมอัตโนมัติ");
      sendToGoogleSheet("AUTO_FAN_ON");
    } 
    else if (t < 33.0 && autoFanActive) { // ปิดเมื่ออุณหภูมิลดลงมาเล็กน้อย
      digitalWrite(FAN_PIN, LOW);
      autoFanActive = false;
      client.publish("home/fan", "OFF");
      sendTelegram("❄️ อุณหภูมิลดลง (" + String(t) + "°C): ปิดพัดลมอัตโนมัติ");
      sendToGoogleSheet("AUTO_FAN_OFF");
    }
  }

  // --- 2. Logic ตบมือไฟติด-ดับ (Clap Switch) ---
  if (soundVal > 3000 && (millis() - lastClapTime > 600)) {
    lightState = !lightState;
    digitalWrite(LED_WHITE_1, lightState ? HIGH : LOW);
    String s = lightState ? "ON" : "OFF";
    sendToGoogleSheet("CLAP_LIGHT_" + s);
    client.publish("home/led1", s.c_str());
    lastClapTime = millis();
    sendTelegram(lightState ? "💡 ไฟบ้าน: เปิดแล้ว" : "🌑 ไฟบ้าน: ปิดแล้ว (ตบมือ)");
  }

  // --- 3. การแสดงผล OLED ---
  static int lastOLEDStatus = -1;
  static bool lastLightOLED = !lightState;
  static float lastT = -1.0;
  
  // อัปเดตจอเมื่ออุณหภูมิเปลี่ยน หรือสถานะอุปกรณ์เปลี่ยน
  if (isDoorOpen != lastOLEDStatus || lightState != lastLightOLED || abs(t - lastT) > 0.5) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Smart Home System");
    display.printf("T: %.1f C H: %.1f %%\n", isnan(t) ? 0 : t, isnan(h) ? 0 : h);
    display.printf("Light: %s\n", lightState ? "ON" : "OFF");
    display.printf("Fan: %s\n", digitalRead(FAN_PIN) ? "ON" : "OFF"); // โชว์สถานะพัดลม
    display.setCursor(0, 48);
    if (isDoorOpen) display.println(">> DOOR OPEN! <<");
    else display.println("Door: Closed");
    display.display();
    
    lastOLEDStatus = isDoorOpen;
    lastLightOLED = lightState;
    lastT = t;
  }

  // --- 4. ระบบกันขโมย (Security Mode) ---
  if (isSecurityOn && isDoorOpen) {
    tone(BUZZER_PIN, 500); 
    digitalWrite(LED_ALERT, (millis() / 200) % 2);
    static unsigned long lastAlertNotify = 0;
    if (millis() - lastAlertNotify > 10000) {
      sendTelegram("🚨 [SECURITY ALERT] มีผู้บุกรุก!");
      sendToGoogleSheet("INTRUDER_ALARM");
      lastAlertNotify = millis();
    }
  } else {
    noTone(BUZZER_PIN);
    digitalWrite(LED_ALERT, LOW);
  }

  // --- 5. แจ้งเตือนสถานะประตูเปลี่ยนไป ---
  static bool prevDoorState = false;
  if (isDoorOpen != prevDoorState) {
    String dStatus = isDoorOpen ? "OPENED" : "CLOSED";
    sendTelegram(isDoorOpen ? "❌ Door Opened" : "✅ Door Closed");
    sendToGoogleSheet("DOOR_" + dStatus);
    prevDoorState = isDoorOpen;
  }
}
