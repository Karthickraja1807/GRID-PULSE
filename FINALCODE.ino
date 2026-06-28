/*
 * GridPulse PZEM-004T v3.0 & ESP32
 * Upload this sketch using the Arduino IDE
 * Libraries Required: Thinger.io, PZEM004Tv30, ESP_Mail_Client (for direct emails)
 */

//#define THINGER_SERIAL_DEBUG
#include <WiFi.h>
#include <ThingerESP32.h>
#include <PZEM004Tv30.h>
#include <ESP_Mail_Client.h> // For sending emails directly from ESP32

// Thinger.io Connection Settings
#define USERNAME "KADHIR"
#define DEVICE_ID "123"
#define DEVICE_CREDENTIAL "-c0vw7#nzINhOI3G"

// WiFi Credentials
#define SSID "RoBridge-5G"
#define SSID_PASSWORD "rajalakshmi23"

// SMTP Configuration (e.g., Gmail SMTP)
#define SMTP_HOST "smtp.gmail.com"
#define SMTP_PORT 465
#define SENDER_EMAIL "robridgesmartmeter@gmail.com"
#define SENDER_PASSWORD "ivtm dgsa epku eywg" // Use Gmail App Password
#define RECIPIENT_EMAIL "karthickraja.r.2024.ece@rajalakshmi.edu.in"

// Hardware Serial 2 Pins for PZEM
#define RXD2 16
#define TXD2 17

// Thresholds for ESP32 safety monitoring
const float OVER_VOLTAGE_LIMIT = 245.0; // Volts
const float MAX_POWER_LIMIT     = 3000.0; // Watts
const float MAX_ENERGY_LIMIT = 0.01;   // kWh;   // kWh

ThingerESP32 thing(USERNAME, DEVICE_ID, DEVICE_CREDENTIAL);
PZEM004Tv30 pzem(Serial2, RXD2, TXD2);
SMTPSession smtp;

// State flags to prevent spamming multiple emails for the same continuous event
bool overVoltageAlertSent = false;
bool overloadAlertSent = false;
bool overEnergyAlertSent = false;

// Function declarations
void sendDirectEmailAlert(String subject, String messageText);

void setup() {
  Serial.begin(115200);
  
  // Set up Thinger WiFi
  thing.add_wifi(SSID, SSID_PASSWORD);
  
  // Define Thinger Resource: "pzem"
   thing["pzem"] >> [](pson& out){
    float voltage = pzem.voltage();
    float current = pzem.current();
    float power = pzem.power();
    float energy = pzem.energy();
    float frequency = pzem.frequency();
    float pf = pzem.pf();
    
    // Safety check - If sensor reading fails, assign 0
    out["voltage"] = (!isnan(voltage)) ? voltage : 0.0;
    out["current"] = (!isnan(current)) ? current : 0.0;
    out["power"] = (!isnan(power)) ? power : 0.0;
    out["energy"] = (!isnan(energy)) ? energy : 0.0;
    out["frequency"] = (!isnan(frequency)) ? frequency : 0.0;
    out["pf"] = (!isnan(pf)) ? pf : 0.0;
    out["online"] = true; // Heartbeat status
    
    // ----------------------------------------------------
    // LIVE ESP32 SAFETY LIMITS & DIRECT SMTP EMAIL LOGIC
    // ----------------------------------------------------
    if (!isnan(voltage)) {
      // 1. Over-Voltage Monitor
      if (voltage > OVER_VOLTAGE_LIMIT) {
        if (!overVoltageAlertSent) {
          sendDirectEmailAlert("⚠️ [ESP32 Alert] Over-Voltage Detected!", 
                               "Critical Voltage Threshold Exceeded!\nMeasured: " + String(voltage, 1) + " V\nThreshold: " + String(OVER_VOLTAGE_LIMIT, 1) + " V");
          overVoltageAlertSent = true;
        }
      } else if (voltage < (OVER_VOLTAGE_LIMIT - 5.0)) {
        overVoltageAlertSent = false; // Reset alert flag when voltage returns to safe range
      }
      
      // 2. Over-Load Power Monitor
      if (power > MAX_POWER_LIMIT) {
        if (!overloadAlertSent) {
          sendDirectEmailAlert("🚨 [ESP32 Alert] System Overload!", 
                               "Total Wattage Draw Exceeds Capacity!\nMeasured: " + String(power, 1) + " W\nThreshold: " + String(MAX_POWER_LIMIT, 1) + " W");
          overloadAlertSent = true;
        }
      } else if (power < (MAX_POWER_LIMIT - 100.0)) {
        overloadAlertSent = false;
      }
      
      // 3. Monthly Budget/Energy Cap Monitor
      if (energy > MAX_ENERGY_LIMIT) {
        if (!overEnergyAlertSent) {
          sendDirectEmailAlert("📈 [ESP32 Alert] Energy Consumption Target Crossed!", 
                               "The set monthly energy ceiling has been crossed.\nMeasured: " + String(energy, 2) + " kWh\nBudget: " + String(MAX_ENERGY_LIMIT, 1) + " kWh");
          overEnergyAlertSent = true;
        }
      }
    }
  };
}

void loop() {
  thing.handle();
}

/**
 * Direct SMTP Email Dispatcher Function (Uses ESP_Mail_Client)
 */
void sendDirectEmailAlert(String subject, String messageText) {
  Serial.println("Initiating direct SMTP email dispatch from ESP32...");
  
  Session_Config config;
  config.server.host_name = SMTP_HOST;
  config.server.port = SMTP_PORT;
  config.login.email = SENDER_EMAIL;
  config.login.password = SENDER_PASSWORD;
  config.login.user_domain = "";

  SMTP_Message message;
  message.sender.name = "ESP32 Energy Monitor";
  message.sender.email = SENDER_EMAIL;
  message.subject = subject;
  message.addRecipient("Receiver", RECIPIENT_EMAIL);
  
  // Set text message body
  message.text.content = messageText.c_str();
  message.text.charSet = "us-ascii";
  message.text.transfer_encoding = Content_Transfer_Encoding::enc_7bit;
  
  if (!smtp.connect(&config)) {
    Serial.printf("SMTP Connection error, Status Code: %d, Reason: %s\n", smtp.statusCode(), smtp.errorReason().c_str());
    return;
  }

  if (!MailClient.sendMail(&smtp, &message)) {
    Serial.printf("Error sending Email, Reason: %s\n", smtp.errorReason().c_str());
  } else {
    Serial.println("Email alert sent successfully directly from ESP32!");
  }
}