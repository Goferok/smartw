import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import Slider from "@react-native-community/slider";
//import CircularSlider from 'react-native-circular-slider';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from "@react-navigation/native"; // Импортируем RouteProp
import Icon from "react-native-vector-icons/Ionicons";
import dgram from "react-native-udp";
import { RootStackParamList } from "../AppNavigator"; // Импортируем тип из AppNavigator





// 🟢 Определяем интерфейс PWM-значений
interface PWMValues {
  pwm3000K: number;
  pwm4000K: number;
  pwm5000K: number;
  pwm5700K: number;
}

const sunlightModes = [
  { name: "Рассвет", color: "#FFB74D", pwm: { pwm3000K: 255, pwm4000K: 80, pwm5000K: 40, pwm5700K: 20 } },
  { name: "Утреннее солнце", color: "#FFA726", pwm: { pwm3000K: 255, pwm4000K: 150, pwm5000K: 100, pwm5700K: 50 } },
  { name: "Дневное солнце", color: "#FF9800", pwm: { pwm3000K: 180, pwm4000K: 200, pwm5000K: 200, pwm5700K: 180 } },
  { name: "Полуденное сияние", color: "#FFC107", pwm: { pwm3000K: 120, pwm4000K: 180, pwm5000K: 255, pwm5700K: 255 } },
  { name: "Послеобеденное солнце", color: "#FFB300", pwm: { pwm3000K: 160, pwm4000K: 180, pwm5000K: 160, pwm5700K: 120 } },
  { name: "Закатное солнце", color: "#FFA726", pwm: { pwm3000K: 255, pwm4000K: 120, pwm5000K: 80, pwm5700K: 40 } },
  { name: "Предзакатное свечение", color: "#FFB74D", pwm: { pwm3000K: 255, pwm4000K: 80, pwm5000K: 40, pwm5700K: 1 } },
  { name: "Сумерки", color: "#FF8A65", pwm: { pwm3000K: 180, pwm4000K: 60, pwm5000K: 20, pwm5700K: 1 } },
];

const sliderColors = {
  pwm3000K: "#FFB74D",
  pwm4000K: "#FFA726",
  pwm5000K: "#FF9800",
  pwm5700K: "#FFC107",
};

export default function ModesScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "Modes">>();
  const { deviceIp } = route.params; // Извлекаем deviceIp из параметров маршрута

  const [selectedMode, setSelectedMode] = useState("");
  const [pwmValues, setPwmValues] = useState<PWMValues>({ pwm3000K: 0, pwm4000K: 0, pwm5000K: 0, pwm5700K: 0 });
  const [holdMode, setHoldMode] = useState(false);
  const [relayState, setRelayState] = useState(false);
  const [deviceName, setDeviceName] = useState("ESP32-Device");
  const [deviceLocation, setDeviceLocation] = useState("Не указано");
  const [loading, setLoading] = useState(false);
  const lastSelectedMode = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof dgram.createSocket> | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchAllDeviceData(true); // ✅ Загружаем данные с индикатором при входе
    }, [deviceIp])
  );
// 🟢 Следим за изменением `pwmValues` и определяем режим
useEffect(() => {
  detectPresetMode(pwmValues);
}, [pwmValues]);

  /* 🔄 Автообновление данных каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllDeviceData(false); // ✅ Обновляем данные без индикатора загрузки
    }, 5000);
  
    return () => clearInterval(interval); // ✅ Очищаем интервал при выходе
  }, [deviceIp]);*/
  // 🟢 Добавляем проверку на наличие deviceIp

  const selectMode = (mode: typeof sunlightModes[number]) => {
    lastSelectedMode.current = mode.name; // 🟢 Запоминаем последний режим
    setSelectedMode(mode.name);
    setPwmValues(mode.pwm);
    sendPWMValues(mode.pwm);
  };
  //Отправка состояния Hold на ESP32
  const toggleHoldMode = async (newState: boolean) => {
    setHoldMode(newState); // ✅ Обновляем состояние UI
  
    try {
      const response = await fetch(`http://${deviceIp}/setHoldMode`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `state=${newState ? "on" : "off"}` // ✅ Передаем параметр в ESP32
      });
  
      if (!response.ok) {
        console.error(`⛔ [APP] Ошибка HTTP ${response.status}: ${response.statusText}`);
        return;
      }
  
      console.log(`✅ [APP] Успешно установлено: holdMode = ${newState}`);
    } catch (error) {
      console.error("⛔ [APP] Ошибка сети:", error);
    }
  };
  
  // 🟢 Функция проверки совпадения режима с текущими PWM
  const detectPresetMode = (currentPWM: PWMValues) => {
    const foundMode = sunlightModes.find((mode) =>
      Object.keys(mode.pwm).every(
        (key) =>
          Math.abs(mode.pwm[key as keyof PWMValues] - currentPWM[key as keyof PWMValues]) <= 5
      )
    );
  
    if (foundMode) {
      setSelectedMode(foundMode.name); // ✅ Включаем режим, если совпадает
    } else {
      setSelectedMode(""); // ❌ Отключаем режим, если не совпадает
      lastSelectedMode.current = null;
    }
  };
  



  // 📡 Функция обработки UDP-сообщений
  const startListeningForUpdates = () => {
    if (socketRef.current) return; // 🔄 Уже слушаем, не создаем новый сокет

    const socket = dgram.createSocket({ type: "udp4", reusePort: true });

    socket.bind(4210); // 🔥 Привязываем сокет к порту UDP

    socket.on("message", (msg, rinfo) => {
        try {
            const message = msg.toString().trim();
            console.log(`📡 [UDP] Получено: ${message} от ${rinfo.address}`);

            // 🚫 Игнорируем KEEP_ALIVE-сообщения
            if (message.startsWith("ESP_KEEP_ALIVE")) {
                console.log("⚠️ [UDP] Игнорируем KEEP_ALIVE сообщение.");
                return;
            }

            // 🧐 Проверяем, является ли сообщение JSON
            if (!message.startsWith("{")) {
                console.warn("⚠️ [UDP] Получено НЕ JSON-сообщение, пропускаем:", message);
                return;
            }

            console.log("🧐 [DEBUG] Попытка распарсить JSON:", message);
            const data = JSON.parse(message);
            console.log("📡 [UDP] Распакованы данные:", data);

            // ✅ Проверяем, что сообщение от текущего устройства
            if (deviceIp && data.ip !== deviceIp) return;

            // ✅ Обновляем состояние реле
            if ("relayState" in data) {
                setRelayState(data.relayState);
            }

            // ✅ Обновляем PWM значения, если они есть
            if ("pwm3000K" in data && "pwm4000K" in data && "pwm5000K" in data && "pwm5700K" in data) {
                setPwmValues({
                    pwm3000K: data.pwm3000K,
                    pwm4000K: data.pwm4000K,
                    pwm5000K: data.pwm5000K,
                    pwm5700K: data.pwm5700K,
                });
            }

            // ✅ Проверяем, если реле выключено — сбрасываем выбранный режим
            if (data.relayState === false) {
                setSelectedMode("");
            }

            console.log("✅ [UDP] Данные обновлены!");

        } catch (error) {
            console.error("⛔ Ошибка обработки UDP:", error instanceof Error ? error.stack || error.message : JSON.stringify(error));
        }
    });

    socket.on("error", (err) => {
        console.error("⛔ Ошибка UDP:", err);
        socket.close();
        socketRef.current = null;
    });

    socketRef.current = socket;
};

// 🟢 Стартуем слушатель UDP при монтировании
useEffect(() => {
    startListeningForUpdates();
    return () => {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
    };
}, [deviceIp]);


  const fetchAllDeviceData = async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const [pwmRes, relayRes, infoRes] = await Promise.all([
        fetch(`http://${deviceIp}/getPWM`).then((res) => res.json()),
        fetch(`http://${deviceIp}/getRelayState`).then((res) => res.json()),
        fetch(`http://${deviceIp}/getDeviceInfo`).then((res) => res.json()),
      ]);

      setPwmValues(pwmRes);
      setRelayState(relayRes.relayState === "on");
      setDeviceName(infoRes.device_name || "ESP32-Device");
      setDeviceLocation(infoRes.device_location || "Не указано");

      if (relayRes.relayState === "off") {
        setSelectedMode(""); // ❌ Сбрасываем предустановленный режим
      }
    } catch (error) {
      console.error("⛔ Ошибка при получении данных с устройства:", error);
    }

    if (showLoading) setLoading(false);
  };

  const toggleRelay = async () => {
    const newState = !relayState;
    try {
      await fetch(`http://${deviceIp}/setRelay?state=${newState ? "on" : "off"}`, { method: "POST" });
      setRelayState(newState);
      if (!newState) {
        setSelectedMode(""); // ❌ Сбрасываем предустановленный режим
      }
    } catch (error) {
      console.error("⛔ Ошибка при управлении реле:", error);
    }
  };

  const sendPWMValues = async (newValues: PWMValues) => {
    if (!relayState) return; // ❌ Не отправляем, если реле выключено
  
    const pwmUrl = `http://${deviceIp}/setPWM?pwm3000K=${newValues.pwm3000K}&pwm4000K=${newValues.pwm4000K}&pwm5000K=${newValues.pwm5000K}&pwm5700K=${newValues.pwm5700K}`;
    console.log(`⚡ [UI] Отправка PWM: ${pwmUrl}`);
  
    try {
      const res = await fetch(pwmUrl, { method: "POST" });
  
      if (!res.ok) {
        console.error(`⛔ [UI] Ошибка HTTP ${res.status}: ${res.statusText}`);
        return;
      }
  
      console.log("✅ [UI] PWM успешно отправлены");
    } catch (error) {
      console.error("⛔ [UI] Ошибка при отправке PWM:", error);
    }
  };
  const [tempPwmValues, setTempPwmValues] = useState<PWMValues>(pwmValues); // Временные значения для плавности
  
  return (
    
    <View style={styles.container}>
      <Text style={styles.header}>Выбор режима освещения</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#FBC02D" style={styles.loadingIndicator} />
      ) : (
        <>
        {/* 🟢 Имя устройства и расположение */}
      <Text style={styles.deviceInfo}>{deviceName} - {deviceLocation}</Text>

      <TouchableOpacity style={[styles.button, relayState ? styles.buttonOn : styles.buttonOff]} onPress={toggleRelay}>
        <Icon name={relayState ? "moon-outline" : "sunny-outline"} size={32} color={relayState ? "black" : "#EAEAEA"} />
        <Text style={[styles.buttonText, { color: relayState ? "#000" : "#FBC02D" }]}>{relayState ? "Выключить окно" : "Включить окно"} </Text>
      </TouchableOpacity>
{/* 🔥 Область, которая становится неактивной при выключении окна */}
<View style={[styles.disabledContainer, !relayState && styles.inactive]}>
      {/* 🟢 Контейнер для режимов */}
<View style={styles.modesContainer}>
  <FlatList
    data={sunlightModes}
    numColumns={2}
    keyExtractor={(item) => item.name}
    renderItem={({ item }) => (
        <TouchableOpacity
        style={[styles.modeButton, selectedMode === item.name && styles.selectedMode]}
        onPress={() => {
          setSelectedMode(item.name);
          setPwmValues(item.pwm);
          sendPWMValues(item.pwm); // Отправляем значения сразу
        }}
      >
        <Text style={[styles.modeText, { color: selectedMode === item.name ? "#222" : "#fff" }]}>
          {item.name}
        </Text>
      </TouchableOpacity>
      
    )}
    columnWrapperStyle={styles.row}
  />
</View>

   {/* 🔥 Слайдеры управления PWM */}
<View style={styles.modesContainer}>
  {Object.keys(pwmValues).map((channel) => {
    const percentage = Math.round((pwmValues[channel as keyof PWMValues] / 255) * 100);
    const sliderValue = pwmValues[channel as keyof PWMValues]; // Текущее значение PWM

    return (
      <View key={channel} style={styles.sliderWrapper}>
        
        {/* 🔥 Исправленный текст: убрано дублирование "К", % выровнен вправо */}
        <View style={styles.sliderLabelContainer}>
          <Text style={styles.sliderLabel}>{channel.replace("pwm", "")}K</Text>
          <Text style={styles.sliderLabel}>{percentage}%</Text>
        </View>

        {/* 🔥 Увеличенный слайдер */}
        <View>
        <Slider
  minimumValue={0}
  maximumValue={255}
  step={13}
  value={pwmValues[channel as keyof PWMValues] || 0} // 🛠 Добавлен fallback (если undefined, то 0)
  onSlidingComplete={(value) => {
    const roundedValue = Math.round(value); // 🔥 Округляем значение
    const newPwmValues = { ...pwmValues, [channel]: roundedValue };
    setPwmValues(newPwmValues); // ✅ Обновляем состояние только после отпускания
    sendPWMValues(newPwmValues); // ✅ Отправляем значения на контроллер
  }}
  minimumTrackTintColor={sliderColors[channel as keyof typeof sliderColors]}
  maximumTrackTintColor="#282A36"
  thumbTintColor={relayState ? "#FBC02D" : "#666"}
  disabled={!relayState}
  style={styles.slider}
/>


        </View>
      </View>
    );
  })}
</View>

      <View style={styles.switchContainer}>
        <Text style={styles.deviceInfo}>Ручной режим до завтра</Text>
        <Switch 
  value={holdMode} 
  onValueChange={toggleHoldMode} // ✅ Теперь отправляем данные на контроллер
  thumbColor={holdMode ? "#FBC02D" : "#666"}
  trackColor={{ false: "#282A36", true: "#FBC02D" }}
  ios_backgroundColor="#282A36"
/>
        </View>
        </View>
        </>
        
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1E1E2E", paddingTop: 50, padding: 10 },
  deviceInfo: { fontSize: 18, color: "#EAEAEA", textAlign: "center", marginBottom: 10 },
  header: { fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#EAEAEA", marginBottom: 10 },
  modesContainer: { marginBottom: 10, borderWidth: 1, borderColor: "#374151", borderRadius: 10, padding: 10},
  button: { width: "100%",height: 60,backgroundColor: "#FBC02D",justifyContent: "center",alignItems: "center",borderRadius: 10,marginBottom: 10,flexDirection: "row", minHeight: 60 },
  buttonOn: { backgroundColor: "#FBC02D" },
  buttonOff: { backgroundColor: "#374151" },
  buttonText: { fontSize: 16, color: "#FBC02D", marginLeft: 10, fontWeight: "bold" },
  modeButton: {flex: 1, padding: 10,backgroundColor: "#282A36",marginBottom: 5,marginHorizontal: 5,borderRadius: 10,alignItems: "center",justifyContent: "center",minHeight: 60},
  selectedMode: { backgroundColor: "#FBC02D" },
  modeText: { fontSize: 16, color: "#EAEAEA", textAlign: "center",fontWeight: "bold"},
  switchContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 0},
  sliderWrapper: { marginBottom: 20 },
  sliderLabel: { color: "#fff", fontSize: 14, marginBottom: 5 },
  row: { justifyContent: "space-between" },
  sliderLabelContainer: { flexDirection: "row", justifyContent: "space-between"},
  slider: { width: "100%", height: 20, transform: [{ scaleY: 1 },{ scaleX: 1 }]},
  inactive: { opacity: 0.4, pointerEvents: "none" },
  disabledContainer: { width: "100%", marginTop: 10 },
  loadingIndicator: {flex: 1,justifyContent: "center",alignItems: "center",marginTop: 20,},
  
  
});