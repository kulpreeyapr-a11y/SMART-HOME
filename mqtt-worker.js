const mqtt = require('mqtt');
const mongoose = require('mongoose');

// 1. เชื่อมต่อ MongoDB (อ้างอิงจาก MongoDB Compass ที่หนูมี)
mongoose.connect('mongodb://127.0.0.1:27017/smarthome_g3')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 2. ออกแบบตารางเก็บข้อมูล (Schema)
const SensorSchema = new mongoose.Schema({
  topic: String,
  value: String,
  timestamp: { type: Date, default: Date.now }
});
const DataLog = mongoose.model('DataLog', SensorSchema);

// 3. เชื่อมต่อ MQTT Broker
const client = mqtt.connect('mqtt://broker.emqx.io');

client.on('connect', () => {
  console.log('✅ MQTT Connected');
  // กดติดตามหัวข้อที่ ESP32 ส่งมา
  client.subscribe(['home/temp', 'home/humi', 'home/security', 'home/noise']);
});

client.on('message', async (topic, message) => {
  const payload = message.toString();
  console.log(`📩 Received: ${topic} -> ${payload}`);

  // บันทึกลง MongoDB Compass ทันที
  try {
    await DataLog.create({ topic: topic, value: payload });
  } catch (err) {
    console.error('❌ Save to DB Error:', err);
  }
});