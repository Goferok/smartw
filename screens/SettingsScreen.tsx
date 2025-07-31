import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  ActivityIndicator
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRoute, RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import DatePicker from "react-native-date-picker";
import dgram from "react-native-udp";
import { RootStackParamList } from "../AppNavigator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";







export default function SettingsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Settings">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { deviceIp, isDemoMode } = route.params;
  //const [deviceIp, setDeviceIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceName, setDeviceName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("");
  const [timezone, setTimezone] = useState(3);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"name" | "location" | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [currentTime, setCurrentTime] = useState("00:00");
  const [currentDay, setCurrentDay] = useState("Понедельник");
  const [autoMode, setAutoMode] = useState(false);
  const [schedule, setSchedule] = useState<Record<string, { start: Date; end: Date; enabled: boolean }>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<"start" | "end">("start");
  const [presenceSensorEnabled, setPresenceSensorEnabled] = useState(false);
  const [presenceTimeout, setPresenceTimeout] = useState<number>(5); // В минутах (по умолчанию 5 мин)
  const previousScheduleRef = useRef<Record<string, { start: Date; end: Date; enabled: boolean }>>({});
  // 📌 Таймер для debounce
  const scheduleUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<ReturnType<typeof dgram.createSocket> | null>(null);
  const isMounted = useRef(true);
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [firmwareModalVisible, setFirmwareModalVisible] = useState(false);
  const [latestFirmwareVersion, setLatestFirmwareVersion] = useState<string | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timeIntervalRef = useRef<number | null>(null);



  // 🟢 Индексация контроллера остается неизменной
  const weekdaysController = [
    "Воскресенье", "Понедельник", "Вторник", "Среда",
    "Четверг", "Пятница", "Суббота"
  ];

  type ScheduleEntry = {
    start: string;
    end: string;
    enabled: boolean;
  };
  const timezones = [
    { value: -12, label: "UTC -12:00 (Бейкер, Хауленд)" },
    { value: -11, label: "UTC -11:00 (Самоа, Мидуэй)" },
    { value: -10, label: "UTC -10:00 (Гонолулу, Таити)" },
    { value: -9, label: "UTC -09:00 (Аляска, Гамбиер)" },
    { value: -8, label: "UTC -08:00 (Лос-Анджелес, Ванкувер)" },
    { value: -7, label: "UTC -07:00 (Денвер, Феникс)" },
    { value: -6, label: "UTC -06:00 (Чикаго, Мехико)" },
    { value: -5, label: "UTC -05:00 (Нью-Йорк, Богота, Лима)" },
    { value: -4, label: "UTC -04:00 (Каракас, Сантьяго)" },
    { value: -3, label: "UTC -03:00 (Буэнос-Айрес, Бразилиа)" },
    { value: -2, label: "UTC -02:00 (Среднеатлантическое время)" },
    { value: -1, label: "UTC -01:00 (Азорские острова)" },
    { value: 0, label: "UTC 00:00 (Лондон, Лиссабон)" },
    { value: 1, label: "UTC +01:00 (Париж, Берлин)" },
    { value: 2, label: "UTC +02:00 (Киев, Афины)" },
    { value: 3, label: "UTC +03:00 (Москва)" },
    { value: 4, label: "UTC +04:00 (Дубай, Самара)" },
    { value: 5, label: "UTC +05:00 (Екатеринбург, Карачи)" },
    { value: 6, label: "UTC +06:00 (Омск, Алматы)" },
    { value: 7, label: "UTC +07:00 (Красноярск, Бангкок)" },
    { value: 8, label: "UTC +08:00 (Иркутск, Пекин)" },
    { value: 9, label: "UTC +09:00 (Якутск, Токио)" },
    { value: 10, label: "UTC +10:00 (Владивосток, Сидней)" },
    { value: 11, label: "UTC +11:00 (Магадан)" },
    { value: 12, label: "UTC +12:00 (Камчатка, Фиджи)" },
  ];
  useEffect(() => {
    
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  /*useEffect(() => {
    const getDeviceIp = async () => {
      const storedIp = await AsyncStorage.getItem("selectedDevice");
      if (!storedIp) {
        console.error("❌ Ошибка: устройство не выбрано!");
        return;
      }
      setDeviceIp(storedIp);
    };
  
    getDeviceIp();
  }, []);*/
  useFocusEffect(
    React.useCallback(() => {
      if (!deviceIp) {
        Alert.alert("Ошибка", "Устройство не выбрано. Возврат на главную.");
        navigation.navigate("MainTabs", { screen: "Home" });

        return;
      }

      setLoading(true);
      Promise.all([
        fetchSchedule(),
        fetchCurrentTime(),
        fetchAutoModeState(),
        loadDeviceInfo(),
        fetchPresenceSensorState(),
      ])
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    }, [deviceIp])
  );

  // 🗓 Функция преобразования числа (0-6) в название дня недели
  const parseWeekday = (dayNumber: number) => {
    return weekdaysController[dayNumber] || "Неизвестно";
  };
  
  //Функция проверки версии прошивки
  const checkFirmwareVersion = async () => {
  if (!deviceIp) return;

  if (isDemoMode) {
    // 🔧 Ветка демо-режима
    console.log("🧪 Демо-режим: проверка версии прошивки");
    setFirmwareVersion("1.0.0-demo");
    setLatestFirmwareVersion("1.1.0-demo");
    setFirmwareModalVisible(true);
    return;
  }

  try {
    const res = await fetch(`http://${deviceIp}/getFirmwareVersion`);
    const data = await res.json();
    const currentVersion = data.version;
    setFirmwareVersion(currentVersion);

    const versionRes = await fetch(`https://storage.yandexcloud.net/firmware-updates/firmware_version.txt`);
    const latestVersion = (await versionRes.text()).trim();
    setLatestFirmwareVersion(latestVersion);

    setFirmwareModalVisible(true);
  } catch (error) {
    console.error("⛔ Ошибка при проверке прошивки:", error);
    Alert.alert("Ошибка", "Не удалось проверить версию прошивки.");
  }
};
  
  //Функция обновления прошивки
  const updateFirmware = async () => {
  if (isDemoMode) {
    console.log("🧪 Демо-режим: обновление прошивки не выполняется");
    Alert.alert("Демо-режим", "В демо-режиме обновление прошивки не поддерживается.");
    return;
  }

  if (!deviceIp) return;
  setUpdating(true);

  try {
    const response = await fetch(`http://${deviceIp}/updateFirmware`, {
      method: "POST",
    });

    if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

    console.log("✅ Обновление запущено");

    setTimeout(() => {
      setUpdating(false);
      Alert.alert("Готово", "Прошивка обновлена. Устройство будет перезагружено.");
    }, 10000);
  } catch (err) {
    console.error("⛔ Ошибка обновления:", err);
    setUpdating(false);
    Alert.alert("Ошибка", "Не удалось обновить прошивку.");
  }
};

  
  const fetchWithTimeout = (url: string, timeout: number = 2000): Promise<Response> => {
    return Promise.race([
      fetch(url),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
    ]);
  };


  const waitForDeviceToComeBack = () => {
    const retryInterval = setInterval(async () => {
      try {
        const res = await fetchWithTimeout(`http://${deviceIp}/getFirmwareVersion`, 2000);
        if (res.ok) {
          const data = await res.json();
          setFirmwareVersion(data.version);
          setUpdating(false);
  
          // 🟢 Восстанавливаем обновления и запросы
          startListeningForUpdates();
          fetchAutoModeState();
          fetchCurrentTime();
          fetchSchedule();
          fetchPresenceSensorState();
  
          clearInterval(retryInterval);
          updateIntervalRef.current = null;
  
          Alert.alert("✅ Обновление завершено", "Устройство снова в сети.");
        }
      } catch (e) {
        // Ждем появления устройства
      }
    }, 3000);
  
    updateIntervalRef.current = retryInterval;
  };
  
  
  
  

  // 📡 Функция форматирования времени (чтобы корректно отображать 00:00)
  const formatTime = (date: Date | string): string => {
    if (typeof date === "string") {
      console.log("⏰ Форматируем строку:", date);
      const parts = date.split(":");
      if (parts.length !== 2) return "00:00";

      const hours = parts[0].padStart(2, "0");
      const minutes = parts[1].padStart(2, "0");

      return `${hours}:${minutes}`;
    }

    if (!(date instanceof Date)) {
      console.warn("❌ formatTime: передан некорректный тип!", date);
      return "00:00";
    }

    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  const startListeningForUpdates = () => {
    if (socketRef.current) return;

    const socket = dgram.createSocket({ type: "udp4", reusePort: true });
    socket.bind(4210);

    socket.on("message", (msg, rinfo) => {
      try {
        const message = msg.toString().trim();
        console.log(`📡 [UDP] Получено: ${message} от ${rinfo.address}`);

        if (message.startsWith("ESP_KEEP_ALIVE")) {
          console.log("⚠️ [UDP] Игнорируем KEEP_ALIVE сообщение.");
          return;
        }

        if (!message.startsWith("{")) {
          console.warn("⚠️ [UDP] Получено НЕ JSON-сообщение, пропускаем:", message);
          return;
        }

        console.log("🧐 [DEBUG] Попытка распарсить JSON:", message);
        const data = JSON.parse(message);
        console.log("📡 [UDP] Распакованы данные:", data);

        if (deviceIp && data.ip !== deviceIp) return;

        if (data.deviceName) setDeviceName(data.deviceName);
        if (data.deviceLocation) setDeviceLocation(data.deviceLocation);
        if ("autoMode" in data) setAutoMode(data.autoMode);

        if (data.schedule && Array.isArray(data.schedule)) {
          const newSchedule: { [key: string]: { start: Date; end: Date; enabled: boolean } } = {};
          data.schedule.forEach((entry: { start: string; end: string; enabled: boolean }, index: number) => {
            if (index >= weekdaysController.length) return;

            if (typeof entry.start !== "string" || typeof entry.end !== "string" || typeof entry.enabled !== "boolean") {
              console.warn(`⚠️ [UDP] Ошибка в расписании для дня ${index}:`, entry);
              return;
            }

            const startTime = new Date(`2000-01-01T${entry.start}:00`);
            const endTime = new Date(`2000-01-01T${entry.end}:00`);

            newSchedule[weekdaysController[index]] = {
              start: startTime,
              end: endTime,
              enabled: entry.enabled,
            };
          });

          setSchedule(newSchedule);
          console.log("✅ [UDP] Расписание обновлено", newSchedule);
        }

        console.log("✅ [UDP] Данные обновлены!");

      } catch (error) {
        if (error instanceof Error) {
          console.error("⛔ Ошибка обработки UDP:", error.stack || error.message);
        } else {
          console.error("⛔ Ошибка обработки UDP: Неизвестный тип ошибки", JSON.stringify(error));
        }
      }
    });

    socket.on("error", (err) => {
      console.error("⛔ Ошибка UDP:", err);
      socket.close();
      socketRef.current = null;
    });

    socketRef.current = socket;
  };

  useEffect(() => {
    startListeningForUpdates();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [deviceIp]);





  // 🟢 Запуск слушателя при монтировании
  useEffect(() => {
    startListeningForUpdates();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [deviceIp]);



  // ✅ Функция получения авто режима с контроллера
const fetchAutoModeState = async () => {
  if (!deviceIp) return;

  if (isDemoMode) {
    // 🔧 Демо-режим — подставим фейковое значение
    console.log("🧪 Демо-режим: получение autoMode");
    if (isMounted.current) {
      setAutoMode(true); // или false, если хочешь имитировать выключенный режим
    }
    return;
  }

  try {
    const res = await fetch(`http://${deviceIp}/getAutoMode`);
    const data = await res.json();

    if (isMounted.current && data && "autoMode" in data) {
      setAutoMode(data.autoMode);
    }
  } catch (error) {
    console.error("⛔ Ошибка при получении autoMode:", error);
  }
};



  // ✅ Функция обновления режима на контроллере
const updateAutoMode = async (newValue: boolean) => {
  if (!deviceIp) return;

  if (isDemoMode) {
    // 🔧 Демо-режим: имитируем включение/выключение
    console.log(`🧪 Демо-режим: autoMode=${newValue}`);
    setAutoMode(newValue);
    return;
  }

  const stateStr = newValue ? "on" : "off"; // ✅ Контроллер ожидает "on" или "off"
  console.log(`📡 Отправляем autoMode=${stateStr} на контроллер (POST)...`);

  try {
    const response = await fetch(`http://${deviceIp}/setAutoMode`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `state=${stateStr}`,
    });

    if (!response.ok) {
      console.error(`⛔ Ошибка HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    console.log(`✅ Автоматический режим ${newValue ? "ВКЛЮЧЕН" : "ВЫКЛЮЧЕН"}`);
    await fetchAutoModeState(); // ✅ Повторный запрос
  } catch (error) {
    console.error("⛔ Ошибка при отправке autoMode:", error);
    Alert.alert("Ошибка", "Не удалось изменить автоматический режим.");
  }
};



  // 🟢 Загрузка расписания с контроллера
const fetchSchedule = async () => {
  if (!deviceIp) return;

  // ✅ ДЕМО-РЕЖИМ
  if (isDemoMode) {
    console.log("🧪 Демо-режим: загружаем фиктивное расписание");

    const fakeSchedule: Record<string, { start: Date; end: Date; enabled: boolean }> = {};
    weekdaysController.forEach((day, index) => {
      fakeSchedule[day] = {
        start: new Date(`2000-01-01T0${index + 6}:00:00`), // 06:00, 07:00 и т.д.
        end: new Date(`2000-01-01T0${index + 8}:00:00`),   // 08:00, 09:00 и т.д.
        enabled: index % 2 === 0, // включены только чётные дни
      };
    });

    if (isMounted.current) {
      setSchedule(fakeSchedule);
    }

    return;
  }

  // ✅ Обычный режим — загрузка с контроллера
  try {
    const res = await fetch(`http://${deviceIp}/getSchedule`);
    const data: { schedule: ScheduleEntry[] } = await res.json();

    console.log("📥 Получено расписание:", JSON.stringify(data.schedule, null, 2));

    if (!data.schedule || !Array.isArray(data.schedule)) {
      throw new Error("⛔ Некорректный формат данных от контроллера");
    }

    const newSchedule: Record<string, { start: Date; end: Date; enabled: boolean }> = {};

    data.schedule.forEach((entry, index) => {
      if (index >= weekdaysController.length) return;

      const controllerDay = weekdaysController[index];

      newSchedule[controllerDay] = {
        start: new Date(`2000-01-01T${entry.start}:00`),
        end: new Date(`2000-01-01T${entry.end}:00`),
        enabled: entry.enabled ?? false,
      };
    });

    if (isMounted.current) {
      setSchedule(newSchedule);
    }
  } catch (error) {
    console.error("⛔ Ошибка загрузки расписания:", error);
  }
};





  // 🔹 Отправка расписания на ESP32 немедленно после любого изменения
const sendScheduleToESP32 = async (
  updatedSchedule: Record<string, { start: Date; end: Date; enabled: boolean }>
) => {
  if (!deviceIp) return;

  // ✅ Демо-режим — просто логируем действие
  if (isDemoMode) {
    console.log("🧪 ДЕМО: отправка расписания:", updatedSchedule);
    return;
  }

  try {
    const scheduleParams = Object.entries(updatedSchedule)
      .map(([day, entry], i) => {
        const start = formatTime(entry.start);
        const end = formatTime(entry.end);
        const enabled = entry.enabled ? "true" : "false";

        return `start${i}=${start}&end${i}=${end}&enabled${i}=${enabled}`;
      })
      .join("&");

    if (scheduleParams.length === 0) return;

    console.log("📡 Отправляем расписание на контроллер:", scheduleParams);
    await fetch(`http://${deviceIp}/setSchedule?${scheduleParams}`, { method: "GET" });

    console.log("✅ Расписание обновлено на контроллере");
  } catch (error) {
    console.error("⛔ Ошибка отправки расписания:", error);
  }
};




  // ✅ Вызов `sendScheduleToESP32` сразу при изменении расписания
  useEffect(() => {
  if (!isDemoMode && Object.keys(schedule).length > 0) {
    sendScheduleToESP32(schedule);
  } else if (isDemoMode) {
    console.log("🧪 ДЕМО: изменение расписания (useEffect):", schedule);
  }
}, [schedule]);

  // ✅ Функция обновления расписания в UI и немедленной отправки на ESP32
  const updateScheduleEntry = (day: string, key: "start" | "end" | "enabled", value: any) => {
  setSchedule((prevSchedule) => {
    const updatedSchedule = {
      ...prevSchedule,
      [day]: { ...prevSchedule[day], [key]: value },
    };

    // 🔧 Расписание обновляется ТОЛЬКО на контроллер, если это не демо
    if (!isDemoMode) {
      sendScheduleToESP32(updatedSchedule);
    } else {
      console.log("🧪 [Демо] Обновлено только в UI:", updatedSchedule);
    }

    return updatedSchedule;
  });
};


  // ✅ Изменение включения/выключения дня (свитч)
  const toggleDayEnabled = (day: string) => {
    updateScheduleEntry(day, "enabled", !schedule[day].enabled);
  };

  // ✅ Изменение времени начала
  const updateStartTime = (day: string, time: Date) => {
    updateScheduleEntry(day, "start", time);
  };

  // ✅ Изменение времени окончания
  const updateEndTime = (day: string, time: Date) => {
    updateScheduleEntry(day, "end", time);
  };


  // 🔹 Модальное окно изменения имени/локации
  const openModal = (type: "name" | "location") => {
    setModalType(type);
    setInputValue(type === "name" ? deviceName : deviceLocation);
    setModalVisible(true);
  };
  //Загрузка данных имени и расположение с контроллера
  const loadDeviceInfo = async () => {
  if (!deviceIp) return;

  if (isDemoMode) {
    // 🧪 Демонстрационные данные
    setDeviceName("Тестовое устройство");
    setDeviceLocation("Тестовая зона");
    setTimezone(3);
    console.log("🧪 ДЕМО: Загружены фиктивные данные устройства");
    return;
  }

  try {
    const res = await fetch(`http://${deviceIp}/getDeviceInfo`);
    const data = await res.json();

    if (data.device_name) setDeviceName(data.device_name);
    if (data.device_location) setDeviceLocation(data.device_location);
    if (data.timezone) setTimezone(data.timezone);

    console.log("✅ Данные устройства загружены:", data);
  } catch (error) {
    console.error("⛔ Ошибка загрузки данных устройства:", error);
    Alert.alert("Ошибка", "Не удалось загрузить данные устройства.");
  }
};


  useEffect(() => {
  if (isDemoMode) return; // 🧪 В демо-режиме не опрашиваем устройство

  const interval = setInterval(fetchCurrentTime, 5000);
  return () => clearInterval(interval);
}, [deviceIp, isDemoMode]);


  // 📌 Сохранение данных
  const saveChanges = async () => {
  if (!modalType) return;
  Keyboard.dismiss();

  if (isDemoMode) {
    console.log("🧪 [Демо-режим] Сохраняем изменения локально:", inputValue);
    if (modalType === "name") setDeviceName(inputValue);
    if (modalType === "location") setDeviceLocation(inputValue);
    setModalVisible(false);
    return;
  }

  if (!deviceIp) return;

  try {
    const key = modalType === "name" ? "device_name" : "device_location";
    await fetch(`http://${deviceIp}/setDeviceInfo`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `${key}=${encodeURIComponent(inputValue)}`,
    });

    if (isMounted.current) {
      if (modalType === "name") setDeviceName(inputValue);
      if (modalType === "location") setDeviceLocation(inputValue);
      setModalVisible(false);
    }
  } catch (error) {
    console.error("⛔ Ошибка обновления:", error);
  }
};


  //Отправка данных часового пояса на контроллер
  const updateTimezone = async (tz: number) => {
  setTimezone(tz);

  if (isDemoMode) {
    console.log("🧪 [Демо-режим] Часовой пояс обновлён:", tz);
    return;
  }

  try {
    await fetch(`http://${deviceIp}/setTimezone`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `timezone=${tz}`,
    });
  } catch (error) {
    Alert.alert("Ошибка", "Не удалось обновить часовой пояс.");
  }
};

  //Загрузка текущего времени с контроллера
  const fetchCurrentTime = async () => {
  if (isDemoMode) {
    const now = new Date();
    const demoTime = now.toTimeString().slice(0, 5); // hh:mm
    const demoDay = weekdaysController[now.getDay()];

    setCurrentTime(demoTime);
    setCurrentDay(demoDay);

    console.log("🧪 [Демо-режим] Время:", demoTime, "| День:", demoDay);
    return;
  }

  if (!deviceIp) return;

  try {
    const res = await fetch(`http://${deviceIp}/getTime`);
    const data = await res.json();

    if (data.time) {
      setCurrentTime(formatTime(data.time));
    }

    if (data.day !== undefined) {
      const dayIndex = parseInt(data.day, 10);
      if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex < weekdaysController.length) {
        setCurrentDay(weekdaysController[dayIndex]);
      } else {
        setCurrentDay("Неизвестно");
      }
    }
  } catch (error) {
    console.error("⛔ Ошибка загрузки времени:", error);
  }
};



  // ✅ Функция загрузки состояния датчика присутствия
  const fetchPresenceSensorState = async () => {
  if (isDemoMode) {
    console.log("🧪 [Демо-режим] Получаем фейковое состояние датчика присутствия...");

    // Устанавливаем фиктивные значения
    setPresenceSensorEnabled(true);
    setPresenceTimeout(5); // 5 минут

    return;
  }

  if (!deviceIp) return;

  try {
    console.log(`📡 Запрашиваем состояние датчика присутствия у ${deviceIp}...`);
    const res = await fetch(`http://${deviceIp}/getPresenceSensor`);
    const data = await res.json();

    if ("enabled" in data) setPresenceSensorEnabled(data.enabled);
    if ("timeout" in data) {
      const timeoutInMinutes = Math.round(data.timeout / 60); // 🔹 Преобразуем секунды в минуты
      setPresenceTimeout(Math.max(1, timeoutInMinutes)); // Минимум 1 минута
    }

    console.log(`✅ [ESP] Датчик: ${data.enabled ? "ВКЛ" : "ВЫКЛ"}, таймаут: ${data.timeout} сек`);
  } catch (error) {
    console.error("⛔ Ошибка получения состояния датчика:", error);
  }
};


  // ✅ Плавное обновление свитча без задержек + перезапрос данных
  const togglePresenceSensor = async () => {
  const newEnabled = !presenceSensorEnabled; // Инвертируем текущее состояние
  setPresenceSensorEnabled(newEnabled); // Обновляем UI сразу

  if (isDemoMode) {
    console.log(`🧪 [Демо-режим] Меняем датчик присутствия на ${newEnabled ? "ВКЛ" : "ВЫКЛ"}`);
    return;
  }

  if (!deviceIp) return;

  console.log(`📡 Отправляем: Датчик = ${newEnabled ? "ВКЛ" : "ВЫКЛ"}`);
  try {
    const response = await fetch(`http://${deviceIp}/setPresenceSensor`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `enabled=${newEnabled ? "true" : "false"}&timeout=${presenceTimeout * 60}`, // 🔹 Отправляем секунды
    });

    if (!response.ok) {
      throw new Error(`Ошибка HTTP ${response.status}`);
    }

    console.log(`✅ Датчик ${newEnabled ? "ВКЛЮЧЕН" : "ВЫКЛЮЧЕН"}`);
    fetchPresenceSensorState(); // 🔄 Обновляем состояние после отправки
  } catch (error) {
    console.error("⛔ Ошибка отправки данных:", error);
    setPresenceSensorEnabled(!newEnabled); // Если ошибка, возвращаем предыдущее состояние
    Alert.alert("Ошибка", "Не удалось изменить состояние датчика.");
  }
};


  const updatePresenceTimeout = async (value: number) => {
  setPresenceTimeout(value); // ✅ Обновляем UI немедленно
  const timeoutInSeconds = value * 60;

  if (isDemoMode) {
    console.log(`🧪 [Демо-режим] Установлен таймаут ${value} мин (${timeoutInSeconds} сек)`);
    return;
  }

  if (!deviceIp) return;

  console.log(`📡 Отправляем таймаут ${value} мин (${timeoutInSeconds} сек) на контроллер`);

  try {
    const response = await fetch(`http://${deviceIp}/setPresenceSensor`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `enabled=${presenceSensorEnabled ? "true" : "false"}&timeout=${timeoutInSeconds}`,
    });

    if (!response.ok) {
      throw new Error(`Ошибка HTTP ${response.status}`);
    }

    console.log(`✅ Таймаут датчика обновлен: ${value} мин`);
    fetchPresenceSensorState(); // 🔄 Перезапрашиваем состояние после изменения
  } catch (error) {
    console.error("⛔ Ошибка отправки таймаута:", error);
    Alert.alert("Ошибка", "Не удалось изменить таймаут.");
  }
};




  useEffect(() => {
    fetchCurrentTime();
    const interval = setInterval(fetchCurrentTime, 10000);
    return () => clearInterval(interval);
  }, [deviceIp]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}>
        <Text style={styles.header}>Настройки</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#f9c154" style={styles.loadingIndicator} />
        ) : (
          <>
            {/* 🔹 Блок настроек */}
            <View style={styles.settingsBlock}>
              {/* 🔹 Имя устройства */}
              <View style={styles.row}>
                <Text style={styles.label}>Имя устройства:</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.value}>{deviceName}</Text>
                <TouchableOpacity onPress={() => openModal("name")}>
                  <Icon name="pencil-sharp" size={20} color="#f9c154" />
                </TouchableOpacity>
              </View>

              {/* 🔹 Местоположение */}
              <View style={styles.row}>
                <Text style={styles.label}>Расположение:</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.value}>{deviceLocation}</Text>
                <TouchableOpacity onPress={() => openModal("location")}>
                  <Icon name="pencil-sharp" size={20} color="#f9c154" />
                </TouchableOpacity>
              </View>

              {/* 🔹 Часовой пояс */}
              <Text style={styles.label}>Часовой пояс:</Text>
              <Picker selectedValue={timezone} onValueChange={updateTimezone}>
                {timezones.map((tz) => (
                  <Picker.Item key={tz.value} label={tz.label} value={tz.value} />
                ))}
              </Picker>
              


<Modal transparent visible={firmwareModalVisible} animationType="fade">
  <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Обновление прошивки</Text>

        {updating ? (
          <>
            <Text style={{ color: "#EAEAEA", marginBottom: 10 }}>Подождите, идет обновление...</Text>
            <ActivityIndicator size="large" color="#f9c154" />
          </>
        ) : (
          <>
            <Text style={{ color: "#EAEAEA", marginBottom: 10 }}>
              Текущая версия: {firmwareVersion || "неизвестно"}
            </Text>
            <Text style={{ color: "#EAEAEA", marginBottom: 20 }}>
              Последняя версия: {latestFirmwareVersion || "неизвестно"}
            </Text>

            {firmwareVersion !== latestFirmwareVersion ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    updateFirmware(); // запускаем обновление
                  }}
                  style={styles.updateButton}
                >
                  <Text style={styles.buttonText}>Обновить прошивку</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFirmwareModalVisible(false)}
                  style={styles.exitButton}
                >
                  <Text style={styles.exitButtonText}>Закрыть</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => setFirmwareModalVisible(false)}
                style={styles.exitButton}
              >
                <Text style={styles.exitButtonText}>OK</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  </TouchableWithoutFeedback>
</Modal>



              {/* 🔹 Текущее время + день недели */}
              <Text style={styles.label}>Текущее время:</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={[styles.timeText, styles.weekdayText]}> {currentDay}</Text>
              </View>
              <Text style={styles.label}>Прошивка</Text>

              <TouchableOpacity onPress={checkFirmwareVersion} style={styles.button}>
  <Text style={styles.buttonText}>Проверить версию прошивки</Text>
</TouchableOpacity> 
              {/* 🔹 Датчик присутствия */}
              <View style={styles.row}>
                <Text style={styles.label}>Датчик присутствия</Text>
                <Switch
                  value={presenceSensorEnabled}
                  onValueChange={togglePresenceSensor}
                  thumbColor={presenceSensorEnabled ? "#f9c154" : "#666"}
                  trackColor={{ false: "#282A36", true: "#f9c154" }}
                  ios_backgroundColor="#282A36"
                />
              </View>

              {/* 🔹 Настройка времени выключения (отображается только если датчик ВКЛ) */}
              {presenceSensorEnabled && (
                <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
                  <Text style={styles.label}>Выключение через:</Text>

                  <View style={styles.stepperContainer}>
                    {/* 🔹 Кнопка уменьшения времени */}
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => {
                        const newTimeout = Math.max(1, presenceTimeout - 1);
                        setPresenceTimeout(newTimeout);
                        updatePresenceTimeout(newTimeout);
                      }}
                    >
                      <Text style={styles.stepperText}>−</Text>
                    </TouchableOpacity>

                    {/* 🔹 Отображение текущего значения */}
                    <Text style={styles.stepperValue}>{presenceTimeout} мин</Text>

                    {/* 🔹 Кнопка увеличения времени */}
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => {
                        const newTimeout = presenceTimeout + 1;
                        setPresenceTimeout(newTimeout);
                        updatePresenceTimeout(newTimeout);
                      }}
                    >
                      <Text style={styles.stepperText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 🔹 Автоматический режим */}
              <View style={styles.row}>
                <Text style={styles.label}>Автоматический режим</Text>
                <Switch
                  value={autoMode}
                  onValueChange={(newValue) => {
                    setAutoMode(newValue); // 🔄 Обновляем UI сразу
                    updateAutoMode(newValue); // 🔥 Отправляем новое значение на контроллер
                  }}
                  thumbColor={autoMode ? "#f9c154" : "#666"}
                  trackColor={{ false: "#282A36", true: "#f9c154" }}
                  ios_backgroundColor="#282A36"
                />
              </View>
            </View>

            {/* 🔹 Модальное окно */}
            <Modal transparent visible={modalVisible}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalContainer}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>
                      {modalType === "name" ? "Введите новое имя" : "Введите новое местоположение"}
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      value={inputValue}
                      onChangeText={setInputValue}
                      autoFocus
                    />
                    <View style={styles.modalButtons}>
                      <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                        <Text>Отмена</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveChanges} style={styles.saveButton}>
                        <Text>Сохранить</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* Расписание */}
{autoMode && (
  <View style={styles.scheduleContainer}>
    <Text style={styles.scheduleHeader}>График работы</Text>
    {[...weekdaysController.slice(1), weekdaysController[0]].map((day) => {
      const scheduleEntry = schedule[day];

      return (
        <TouchableOpacity
          key={day}
          style={[
            styles.scheduleRow,
            scheduleEntry?.enabled ? styles.activeDay : styles.inactiveDay,
          ]}
          onPress={() => {
            if (!scheduleEntry) return;
            toggleDayEnabled(day);
          }}
        >
          <View style={styles.dayBlock}>
            <Text
              style={[
                styles.scheduleDay,
                { color: scheduleEntry?.enabled ? "#000" : "#EAEAEA" },
              ]}
            >
              {day}
            </Text>
          </View>

          <View style={styles.timeBlock}>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => {
                if (!scheduleEntry) return;
                setSelectedDay(day);
                setPickerType("start");
                setPickerVisible(true);
              }}
            >
              <Text style={styles.timeTextSchedule}>
                {scheduleEntry?.start ? formatTime(scheduleEntry.start) : "00:00"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => {
                if (!scheduleEntry) return;
                setSelectedDay(day);
                setPickerType("end");
                setPickerVisible(true);
              }}
            >
              <Text style={styles.timeTextSchedule}>
                {scheduleEntry?.end ? formatTime(scheduleEntry.end) : "00:00"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    })}
  </View>
)}

{/* 🔹 Окно выбора времени */}
<DatePicker
  modal
  open={pickerVisible}
  date={
    selectedDay && schedule[selectedDay] && schedule[selectedDay][pickerType]
      ? schedule[selectedDay][pickerType]
      : new Date()
  }
  mode="time"
  title="Выберите время"
  confirmText="ОК"
  cancelText="Отмена"
  theme="dark"
  is24hourSource="locale"
  onConfirm={(selectedTime) => {
    if (selectedDay) {
      const newSchedule = {
        ...schedule,
        [selectedDay]: {
          ...schedule[selectedDay],
          [pickerType]: selectedTime,
        },
      };

      setSchedule(newSchedule);

      if (!isDemoMode) {
        sendScheduleToESP32(newSchedule);
      } else {
        console.log("🧪 [Демо] Выбрано новое время:", selectedTime);
      }
    }
    setPickerVisible(false);
  }}
  onCancel={() => setPickerVisible(false)}
/>


          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1E1E2E", paddingTop: 50, padding: 10, paddingBottom: 0, },
  header: { fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#EAEAEA", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  label: { color: "#ccc", fontSize: 16, marginBottom: 5 },
  settingsBlock: { marginBottom: 10, borderWidth: 1, borderColor: "#374151", borderRadius: 10, padding: 10 },
  input: { backgroundColor: "#282A36", color: "#EAEAEA", padding: 10, borderRadius: 8, marginBottom: 10 },
  timeText: { color: "#f9c154", fontSize: 18, marginBottom: 20 },
  switchContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: { width: "80%", backgroundColor: "#282A36", padding: 20, borderRadius: 10, alignItems: "center" },
  modalTitle: { fontSize: 20, color: "#f9c154", fontWeight: "bold", marginBottom: 10 },
  modalInput: { width: "100%", backgroundColor: "#282A36", color: "#EAEAEA", padding: 10, borderRadius: 8, fontSize: 18 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 15 },
  cancelButton: { flex: 1, padding: 10, backgroundColor: "#EAEAEA", borderRadius: 8, alignItems: "center", marginRight: 5 },
  saveButton: { flex: 1, padding: 10, backgroundColor: "#f9c154", borderRadius: 8, alignItems: "center", marginLeft: 5 },
  buttonText: { fontSize: 16, fontWeight: "bold" },
  value: { fontSize: 18, color: "#EAEAEA", fontWeight: "bold", marginBottom: 10 },
  timeInput: { backgroundColor: "#282A36", color: "#EAEAEA", padding: 5, borderRadius: 5, width: 60, textAlign: "center" },
  scheduleContainer: { padding: 10, backgroundColor: "#1E1E2E", borderRadius: 10, borderWidth: 1, borderColor: "#374151" },
  scheduleHeader: { fontSize: 18, color: "#f9c154", fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  weekdayText: { color: "#f9c154", fontSize: 18, },
  scheduleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 5, minHeight: 40 },
  activeDay: { backgroundColor: "#f9c154", },
  inactiveDay: { backgroundColor: "#282A36", },
  dayBlock: { flex: 1, },
  timeBlock: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", flex: 1.2, },
  scheduleDay: { color: "#EAEAEA", fontSize: 16, fontWeight: "bold", },
  timeButton: { backgroundColor: "#282A36", padding: 10, borderRadius: 5, marginLeft: 5, },
  timeTextSchedule: { color: "#f9c154", fontSize: 16, fontWeight: "bold", },
  loadingIndicator: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 20 },
  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 10, },
  stepperButton: { backgroundColor: "#1E1E2E", borderRadius: 10, width: 40, height: 40, justifyContent: "center", alignItems: "center", marginHorizontal: 10, },
  stepperText: { fontSize: 24, fontWeight: "bold", color: "#f9c154", },
  stepperValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#EAEAEA",
    minWidth: 50,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#f9c154",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 5,
  },
  updateButton: {
    backgroundColor: "#f9c154",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 5,
  },
  versionText: {
    fontSize: 16,
    color: "#EAEAEA",
    textAlign: "center",
    marginVertical: 5,
  },
  exitButton: {
    backgroundColor: "#333", // или "#282A36"
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#f9c154",
  },
  
  exitButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f9c154",
  },
  
  
});
