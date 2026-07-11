#include <ACS712.h>
#include <ZMPT101B.h>
#include <ThingerESP32.h>

//==================================================
// THINGER.IO
//==================================================

#define USERNAME "KADHIR"
#define DEVICE_ID "123"
#define DEVICE_CREDENTIAL "-c0vw7#nzINhOI3G"

#define SSID "RoBridge-5G"
#define PASSWORD "rajalakshmi23"

ThingerESP32 thing(USERNAME, DEVICE_ID, DEVICE_CREDENTIAL);

//==================================================
// Pins
//==================================================

#define CURRENT_PIN 35
#define VOLTAGE_PIN 34

//==================================================
// Sensors
//==================================================

// ACS712-20A
ACS712 ACS(CURRENT_PIN, 3.3, 4095, 100);

// ZMPT101B
ZMPT101B voltageSensor(VOLTAGE_PIN, 50.0);

//==================================================
// Variables
//==================================================

float voltage = 0;
float current = 0;
float power = 0;
double energy = 0;

unsigned long previousMillis = 0;

//==================================================
// Thresholds
//==================================================

// Mains OFF
const float MAINS_THRESHOLD = 80.0;

// Ignore tiny sensor noise only
const float MIN_CURRENT = 0.01;   //10mA
const float MIN_POWER = 2.0;      //2VA

//==================================================

void setup()
{
    Serial.begin(115200);

    analogReadResolution(12);

    Serial.println("==================================");
    Serial.println("GridPulse v1.0");
    Serial.println("==================================");

    delay(3000);

    Serial.println("Calibrating ACS712...");
    ACS.autoMidPoint();

    Serial.println("Calibrating ZMPT...");
    voltageSensor.setSensitivity(412);

    thing.add_wifi(SSID, PASSWORD);

    previousMillis = millis();

    //=========================
    // Thinger Resources
    //=========================

    thing["metrics"] >> [](pson &out)
    {
    out["device"] = "GRID-PULSE-01";

    out["online"] = true;

    out["voltage"] = voltage;

    out["current"] = current;

    out["power"] = power;

    out["energy"] = energy;

    if (voltage < MAINS_THRESHOLD)
        out["status"] = "POWER_FAILURE";
    else if (power < MIN_POWER)
        out["status"] = "STANDBY";
    else
        out["status"] = "ACTIVE";

    out["timestamp"] = millis();
    };
    Serial.println("System Ready");
}

void loop()
{
    thing.handle();

    static unsigned long previousSample = 0;

    if (millis() - previousSample >= 1000)
    {
        previousSample = millis();

        voltage = voltageSensor.getRmsVoltage();

        current = ACS.mA_AC(1000) / 1000.0;

        if (voltage < MAINS_THRESHOLD)
        {
            voltage = 0;
            current = 0;
            power = 0;
        }
        else
        {
            if (current < MIN_CURRENT)
                current = 0;

            power = voltage * current;

            if (power < MIN_POWER)
                power = 0;
        }

        unsigned long currentMillis = millis();

        float deltaTime =
            (currentMillis - previousMillis) / 1000.0;

        previousMillis = currentMillis;

        if (power > 0)
        {
            energy +=
                (power * deltaTime) / 3600000.0;
        }

        Serial.println("--------------------------------");

        Serial.print("Voltage : ");
        Serial.print(voltage, 2);
        Serial.println(" V");

        Serial.print("Current : ");
        Serial.print(current, 3);
        Serial.println(" A");

        Serial.print("Power : ");
        Serial.print(power, 2);
        Serial.println(" VA");

        Serial.print("Energy : ");
        Serial.print(energy, 6);
        Serial.println(" kWh");
    }
}
