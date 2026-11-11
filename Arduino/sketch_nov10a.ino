
#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ===== Thong tin WiFi va ThingsBoard =====
const char* WIFI_SSID = "LongNo";
const char* WIFI_PASSWORD = "noiphet123";

const char* MQTT_SERVER = "mqtt.eu.thingsboard.cloud";
const int MQTT_PORT = 1883;
const char* ACCESS_TOKEN = "DIYbTldC7WRVOoNfKYzo";
// ========================================

// ===== PIN =====
const int NHIET_DO_OUT_PIN = 6;
const int HONG_NGOAI_DO_PIN = 7;
const int KHI_DO_PIN = 15;
const int KHI_AO_PIN = 4;
const int COI_3V_PIN = 1;
const int QUAT_PIN = 9;
const int NITO_PIN = 39;
// ===============

// Trang thai thiet bi
int quat_out = LOW;
int coi_out = LOW;
int nito_out = HIGH;

// Trang thai ket noi
bool online = false;

// Timer
unsigned long lastWiFiAttempt = 0;
unsigned long lastMQTTAttempt = 0;
unsigned long lastSensorRead = 0;
unsigned long lastTelemetry = 0;

const unsigned long WIFI_INTERVAL = 10000;
const unsigned long MQTT_INTERVAL = 3000;
const unsigned long SENSOR_INTERVAL = 1000;
const unsigned long TELEMETRY_INTERVAL = 1000;

// Gia tri cam bien
float nhiet_do_out = DEVICE_DISCONNECTED_C;
int hn_do_out = HIGH;
int khi_do_out = HIGH;
int khi_ao_out = 0;

OneWire oneWire(NHIET_DO_OUT_PIN);
DallasTemperature sensors(&oneWire);

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);


// =====================================================
// DIEU KHIEN THIET BI
// =====================================================

void capNhatThietBi() {
    digitalWrite(QUAT_PIN, quat_out);
    digitalWrite(COI_3V_PIN, coi_out);
    digitalWrite(NITO_PIN, nito_out);
}


// =====================================================
// OFFLINE MODE
// =====================================================

void dieuKhienOffline() {

    // 1. Dieu khien coi theo nhiet do
    if (nhiet_do_out != DEVICE_DISCONNECTED_C) {

        if (nhiet_do_out > 60.0) {
            coi_out = HIGH;
        }
        else if (nhiet_do_out < 45.0) {
            coi_out = LOW;
        }
    }

    // 2. Dieu khien quat theo chat luong khong khi
    if (khi_ao_out > 400) {
        quat_out = HIGH;
    }
    else if (khi_ao_out < 400) {
        quat_out = LOW;
    }

    // 3. Dieu khien phun Nito
    // NITO active LOW
    if (nhiet_do_out > 100.0&&hn_do_out == 0 ) {
        nito_out = HIGH;
    }
    else if (nhiet_do_out < 80.0&& hn_do_out == 1) {
        nito_out = HIGH;
    }

    // Cap nhat trang thai cac chan GPIO
    capNhatThietBi();

    Serial.println("===== OFFLINE CONTROL =====");

    Serial.print("Nhiet do: ");
    Serial.println(nhiet_do_out);

    Serial.print("Khi AO: ");
    Serial.println(khi_ao_out);
     Serial.print("flame: ");
    Serial.println(hn_do_out);
    Serial.print("Coi: ");
    Serial.println(coi_out == HIGH ? "ON" : "OFF");

    Serial.print("Quat: ");
    Serial.println(quat_out == HIGH ? "ON" : "OFF");

    Serial.print("Nito: ");
    Serial.println(nito_out == LOW ? "ON" : "OFF");

    Serial.println("===========================");
}


// =====================================================
// RPC
// =====================================================

void xuLyRPC(char* topic, byte* payload, unsigned int length) {

    StaticJsonDocument<256> doc;

    DeserializationError error =
        deserializeJson(doc, payload, length);

    if (error) {
        Serial.println("RPC loi: JSON khong hop le");
        return;
    }

    const char* method = doc["method"] | "";
    JsonVariantConst params = doc["params"];

    bool bat;

    if (params.is<bool>()) {
        bat = params.as<bool>();
    }
    else if (params.is<const char*>()) {
        bat = (strcmp(params.as<const char*>(), "true") == 0);
    }
    else {
        Serial.println("RPC loi: params phai la true/false");
        return;
    }

    const char* tenTrangThai = nullptr;

    if (strcmp(method, "setFan") == 0) {
        quat_out = bat ? HIGH : LOW;
        tenTrangThai = "fan";
    }
    else if (strcmp(method, "setBuzzer") == 0) {
        coi_out = bat ? HIGH : LOW;
        tenTrangThai = "bluzzer";
    }
    else if (strcmp(method, "setNito") == 0) {
        nito_out = bat ? LOW : HIGH;
        tenTrangThai = "nito";
    }
    else {
        Serial.print("RPC khong biet method: ");
        Serial.println(method);
        return;
    }

    capNhatThietBi();

    Serial.print(method);
    Serial.println(bat ? " -> ON" : " -> OFF");

    // Phan hoi ThingsBoard bang request ID
    char* requestId = strrchr(topic, '/');

    if (requestId != nullptr) {

        String responseTopic =
            "v1/devices/me/rpc/response/";

        responseTopic += (requestId + 1);

        String response = "{\"success\":true,\"";
        response += tenTrangThai;
        response += "\":";
        response += bat ? "true" : "false";
        response += "}";

        mqtt.publish(
            responseTopic.c_str(),
            response.c_str()
        );
    }
}


void callback(char* topic, byte* payload, unsigned int length) {

    Serial.print("MQTT nhan topic: ");
    Serial.println(topic);

    Serial.print("Payload: ");

    for (unsigned int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
    }

    Serial.println();

    xuLyRPC(topic, payload, length);
}


// =====================================================
// WIFI
// =====================================================

void batDauWiFi() {

    Serial.println("Bat dau ket noi WiFi...");

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}


void xuLyWiFi() {

    if (WiFi.status() == WL_CONNECTED) {

        if (!online) {
            online = true;

            Serial.println("========================");
            Serial.println("WIFI CONNECTED");
            Serial.println("CHUYEN SANG ONLINE MODE");
            Serial.print("IP: ");
            Serial.println(WiFi.localIP());
            Serial.println("========================");
        }

        return;
    }

    // Mat WiFi
    if (online) {

        online = false;

        Serial.println("========================");
        Serial.println("WIFI DISCONNECTED");
        Serial.println("CHUYEN SANG OFFLINE MODE");
        Serial.println("========================");

        mqtt.disconnect();
    }

    // Thu ket noi lai theo chu ky
    if (millis() - lastWiFiAttempt >= WIFI_INTERVAL) {

        lastWiFiAttempt = millis();

        Serial.println("Dang thu ket noi lai WiFi...");

        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
}


// =====================================================
// MQTT
// =====================================================

void xuLyMQTT() {

    if (!online) {
        return;
    }

    if (mqtt.connected()) {
        mqtt.loop();
        return;
    }

    if (millis() - lastMQTTAttempt >= MQTT_INTERVAL) {

        lastMQTTAttempt = millis();

        Serial.println("Dang ket noi ThingsBoard...");

        if (mqtt.connect(
            "ESP32-client",
            ACCESS_TOKEN,
            nullptr
        )) {

            Serial.println("MQTT connected");

            if (mqtt.subscribe(
                "v1/devices/me/rpc/request/+"
            )) {
                Serial.println("Da subscribe RPC");
            }
            else {
                Serial.println("Subscribe RPC that bai");
            }
        }
        else {

            Serial.print("MQTT that bai, ma loi: ");
            Serial.println(mqtt.state());
        }
    }
}


// =====================================================
// DOC CAM BIEN
// =====================================================

void docCamBien() {

    sensors.requestTemperatures();

    nhiet_do_out = sensors.getTempCByIndex(0);

    if (nhiet_do_out == DEVICE_DISCONNECTED_C) {
        Serial.println("Khong tim thay cam bien nhiet do!");
    }
    else {
        Serial.print("Nhiet do: ");
        Serial.print(nhiet_do_out);
        Serial.println(" C");
    }

    // Hong ngoai
    hn_do_out = digitalRead(HONG_NGOAI_DO_PIN);

    Serial.print("Hong ngoai: ");
    Serial.println(hn_do_out == LOW ? "True" : "False");

    // Khi
    khi_do_out = digitalRead(KHI_DO_PIN);
    khi_ao_out = analogRead(KHI_AO_PIN);

    Serial.print("KHI_DO: ");
    Serial.println(khi_do_out);

    Serial.print("KHI_AO: ");
    Serial.println(khi_ao_out);
}


// =====================================================
// GUI TELEMETRY
// =====================================================

void guiTelemetry() {

    if (!online || !mqtt.connected()) {
        return;
    }

    StaticJsonDocument<256> doc;

    doc["flame"] = (hn_do_out == LOW);

    if (nhiet_do_out != DEVICE_DISCONNECTED_C) {
        doc["temp"] = nhiet_do_out;
    }

    doc["air quality"] = khi_ao_out;
    doc["bluzzer"] = (coi_out == HIGH);
    doc["fan"] = (quat_out == HIGH);
    doc["nito"] = (nito_out == LOW);

    char buffer[256];

    size_t length = serializeJson(doc, buffer);

    if (mqtt.publish(
        "v1/devices/me/telemetry",
        buffer,
        length
    )) {
        Serial.print("Da gui MQTT: ");
        Serial.println(buffer);
    }
    else {
        Serial.println("Gui telemetry that bai");
    }
}


// =====================================================
// SETUP
// =====================================================

void setup() {

    Serial.begin(115200);

    pinMode(HONG_NGOAI_DO_PIN, INPUT);
    pinMode(KHI_DO_PIN, INPUT);
    pinMode(KHI_AO_PIN, INPUT);
    pinMode(NHIET_DO_OUT_PIN, INPUT);

    pinMode(COI_3V_PIN, OUTPUT);
    pinMode(QUAT_PIN, OUTPUT);
    pinMode(NITO_PIN, OUTPUT);

    capNhatThietBi();

    sensors.begin();

    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    mqtt.setCallback(callback);
    mqtt.setBufferSize(512);

    batDauWiFi();
}


// =====================================================
// LOOP
// =====================================================

void loop() {

    // 1. Kiem tra ket noi WiFi
    xuLyWiFi();

    // 2. Xu ly MQTT neu dang Online
    xuLyMQTT();

    // 3. Doc cam bien theo chu ky
    if (millis() - lastSensorRead >= SENSOR_INTERVAL) {

        lastSensorRead = millis();

        docCamBien();

        // 4. Neu Offline thi tu dong dieu khien
        if (!online) {
            dieuKhienOffline();
        }
    }

    // 5. Gui telemetry neu Online
    if (millis() - lastTelemetry >= TELEMETRY_INTERVAL) {

        lastTelemetry = millis();

        guiTelemetry();
    }
}
