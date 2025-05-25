import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native"; // Импортируем useNavigation
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import dgram from "react-native-udp";
import { RootStackParamList } from "../AppNavigator"; // Импортируем тип из AppNavigator
import { NetworkInfo } from "react-native-network-info";
// ✅ ТИП ДАННЫХ УСТРОЙСТВА
type Device = {
  name: string;
  ip: string;
  location: string;
  status: string;
  lastSeen: number;
};

type HomeScreenProps = {
  updateSelectedDevice: (deviceIp: string) => void;
};

const HomeScreen = ({ updateSelectedDevice }: HomeScreenProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const socketRef = useRef<ReturnType<typeof dgram.createSocket> | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const selectDevice = async (deviceIp: string) => {
    if (!deviceIp) {
      showDeviceNotSelectedAlert();
      return;
    }

    updateSelectedDevice(deviceIp); // Обновляем выбранное устройство
    setSelectedDevice(deviceIp); // Обновляем локальное состояние
    navigation.navigate("Modes", { deviceIp }); // Переходим на экран Modes
};

useEffect(() => {
  NetworkInfo.getSSID().then(ssid => {
    if (!ssid) {
      Alert.alert(
        "Нет подключения к Wi-Fi",
        "Пожалуйста, подключитесь к сети Wi-Fi для работы приложения.",
        [{ text: "OK" }]
      );
    }
  });
}, []);
// ✅ Загружаем устройства только один раз при монтировании
useEffect(() => {
  AsyncStorage.removeItem("selectedDevice");
  setSelectedDevice(null);
  loadDevices();
}, []);
// Функция плавного обновления значения слайдера

// Проверка и сортировка устройств
useEffect(() => {
  const interval = setInterval(() => {
    setDevices((prevDevices) => {
      // 🔹 Обновляем статус Online/Offline
      const updatedDevices = prevDevices.map((device) => ({
        ...device,
        status: Date.now() - device.lastSeen > 10000 ? "Offline" : "Online",
      }));

      // 🔹 Сортируем только по статусу (Online → Offline), но не меняем порядок внутри групп
      updatedDevices.sort((a, b) => {
        if (a.status === b.status) return 0; // Если статус одинаковый, сохраняем порядок
        return a.status === "Online" ? -1 : 1; // Online выше, Offline ниже
      });

      return updatedDevices;
    });
  }, 5000);

  return () => clearInterval(interval);
}, []);

    // 📌 Загружаем последнее выбранное устройство при старте
useEffect(() => {
    const loadSelectedDevice = async () => {
      const storedDeviceIp = await AsyncStorage.getItem("selectedDevice");
      if (storedDeviceIp) setSelectedDevice(storedDeviceIp);
    };
    loadSelectedDevice();
  }, []);
  useEffect(() => {
    const socket = dgram.createSocket({ type: "udp4", reusePort: true });
   
    socket.bind(4210);
  
    socket.on("message", (msg, rinfo) => {
      try {
        const message = msg.toString();
        console.log(`📡 [UDP] Получено: ${message} от ${rinfo.address}:${rinfo.port}`);
  
        if (message.startsWith("ESP_KEEP_ALIVE:")) {
          const deviceIp = message.split(":")[1];
  
          setDevices((prevDevices) =>
            prevDevices.map((device) =>
              device.ip === deviceIp
                ? { ...device, status: "Online", lastSeen: Date.now() }
                : device
            )
          );
        }
      } catch (error) {
        console.error("⛔ Ошибка обработки UDP-сообщения:", error);
      }
    });
  
    socket.on("error", (err) => {
      console.error("⛔ Ошибка UDP сокета:", err);
      socket.close();
    });
  
    return () => {
      socket.close();
    };
  }, []); 
// 📡 Функция обработки UDP-сообщений для обновления имени и расположения
const startListeningForDeviceInfoUpdates = () => {
  if (socketRef.current) {
    console.log("⚠️ Сокет уже работает, новый не создаем.");
    return;
  }

  const socket = dgram.createSocket({ type: "udp4", reusePort: true });

  socket.bind(4210, () => {
    console.log("🟢 [UDP Home] Сокет привязан к порту 4210");
  });

  socket.on("message", (msg, rinfo) => {
    try {
      const message = msg.toString().trim();
      console.log(`📡 [UDP Home] Получено: ${message} от ${rinfo.address}`);

      // 🚫 Игнорируем KEEP_ALIVE сообщения
      if (message.startsWith("ESP_KEEP_ALIVE")) {
        console.log("⚠️ [UDP Home] Игнорируем KEEP_ALIVE сообщение.");
        return;
      }

      // 🧐 Проверяем, является ли сообщение JSON
      if (!message.startsWith("{")) {
        console.warn("⚠️ [UDP Home] Получено НЕ JSON-сообщение, пропускаем:", message);
        return;
      }

      console.log("🧐 [DEBUG Home] Попытка распарсить JSON:", message);
      const data = JSON.parse(message);
      console.log("📡 [UDP Home] Распакованы данные:", data);

      // ✅ Проверяем, есть ли IP, имя и расположение (исправлены названия ключей)
      if ("ip" in data && ("deviceName" in data || "deviceLocation" in data)) {
        console.log(`✅ [UDP Home] Обновляем устройство ${data.ip} | Имя: ${data.deviceName} | Расположение: ${data.deviceLocation}`);

        setDevices((prevDevices) => {
          const updatedDevices = prevDevices.map((device) => {
            if (device.ip === data.ip) {
              return {
                ...device,
                name: data.deviceName || device.name,
                location: data.deviceLocation || device.location,
                lastSeen: Date.now(),
              };
            }
            return device;
          });
          return [...updatedDevices];  // Возвращаем новый массив
        });
        

        console.log("✅ [UDP Home] Имя и расположение устройства обновлены.");
      }
    } catch (error) {
      console.error("⛔ Ошибка обработки UDP Home:", error instanceof Error ? error.stack || error.message : JSON.stringify(error));
    }
  });

  socket.on("error", (err) => {
    console.error("⛔ Ошибка UDP Home:", err);
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (error) {
        console.warn("⚠️ Ошибка при закрытии сокета:", error);
      }
      socketRef.current = null;
    }
  });

  socketRef.current = socket;
};
// 🟢 Стартуем слушатель UDP при монтировании HomeScreen
useEffect(() => {
  startListeningForDeviceInfoUpdates();

  return () => {
    if (socketRef.current) {
      console.log("🔴 Закрываем сокет при размонтировании");
      try {
        socketRef.current.close();
      } catch (error) {
        console.warn("⚠️ Ошибка при закрытии сокета:", error);
      }
      socketRef.current = null;
    }
  };
}, []);
 // ✅ Уведомление если не выбраны устройства
 const showDeviceNotSelectedAlert = () => {
  Alert.alert(
    "Устройство не выбрано",
    "Сначала выберите устройство",
    [{ text: "OK", onPress: () => console.log("OK Pressed") }],
    { cancelable: false }
  );
};
  // ✅ Загрузка устройств из AsyncStorage
  const loadDevices = async () => {
    try {
      const storedDevices = await AsyncStorage.getItem("devices");
      if (storedDevices) {
        const parsedDevices = JSON.parse(storedDevices);
        setDevices(parsedDevices);
      }
    } catch (error) {
      console.error("Ошибка загрузки устройств:", error);
    }
  };
  // ✅ Поиск устройств
// ✅ Поиск устройств (новая версия)
const fetchDevices = async () => {
  if (isScanning) {
    console.log("⚠️ Поиск уже выполняется.");
    return;
  }

  setIsScanning(true);
  setSearchStatus("📡 Поиск устройств в сети...");

  const socket = dgram.createSocket({ type: "udp4", reusePort: true });
  socket.bind(4210);

  const discoveredIps = new Set(devices.map((d) => d.ip));

  socket.on("message", (msg, rinfo) => {
    try {
      const message = msg.toString().trim();
      console.log(`📡 [UDP] Получено: ${message} от ${rinfo.address}:${rinfo.port}`);

      // Игнорируем сообщения, не начинающиеся с JSON
      if (!message.startsWith("{")) return;

      const data = JSON.parse(message);

      if ("ip" in data && "deviceName" in data && "deviceLocation" in data) {
        const deviceIp = data.ip;

        if (discoveredIps.has(deviceIp)) {
          // Обновляем уже найденное устройство
          setDevices((prevDevices) =>
            prevDevices.map((device) =>
              device.ip === deviceIp
                ? {
                    ...device,
                    status: "Online",
                    lastSeen: Date.now(),
                    name: data.deviceName,
                    location: data.deviceLocation,
                  }
                : device
            )
          );
        } else {
          // Добавляем новое устройство
          const newDevice: Device = {
            ip: deviceIp,
            name: data.deviceName,
            location: data.deviceLocation,
            status: "Online",
            lastSeen: Date.now(),
          };

          setDevices((prevDevices) => {
            const updatedDevices = [...prevDevices, newDevice];
            AsyncStorage.setItem("devices", JSON.stringify(updatedDevices));
            return updatedDevices;
          });

          discoveredIps.add(deviceIp);
        }
      }
    } catch (error) {
      console.error("⛔ Ошибка обработки UDP-сообщения:", error);
    }
  });

  socket.on("error", (err) => {
    console.error("⛔ Ошибка UDP сокета:", err);
    socket.close();
  });

  setTimeout(() => {
    setSearchStatus("✅ Поиск завершён!");
    setIsScanning(false);
    socket.close();
    setTimeout(() => setSearchStatus(""), 5000);
  }, 15000);
};




  
const removeDevice = (ip: string) => {
  Alert.alert("Удаление устройства", "Вы уверены, что хотите удалить это устройство?", [
    { text: "Отмена", style: "cancel" },
    {
      text: "Удалить",
      style: "destructive",
      onPress: async () => {
        console.log("Удаление устройства:", ip);
        setDevices((prevDevices) => {
          const newDevices = prevDevices.filter((device) => device.ip !== ip);
          console.log("После удаления устройств:", newDevices);
          AsyncStorage.setItem("devices", JSON.stringify(newDevices));
          return newDevices;
        });
      },
    },
  ]);
};


  
return (
  <View style={styles.container}>
    <Text style={styles.title}>Lumi</Text>
    <Text style={styles.titlesmall}>управление исскуственным окном</Text>

    <TouchableOpacity style={styles.searchButton} onPress={fetchDevices} disabled={isScanning}>
      {isScanning ? <ActivityIndicator color="black" /> : <Text style={styles.searchButtonText}>🔍 Поиск устройств</Text>}
    </TouchableOpacity>

    {searchStatus ? <Text style={styles.statusText}>{searchStatus}</Text> : null}

    {/* 🔥 Делаем список устройств прокручиваемым */}
    <View style={styles.devicesContainer}>
      <Text style={styles.devicesHeader}>Найденные устройства</Text>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <FlatList
          data={devices}
          keyExtractor={(item) => item.ip}
          renderItem={({ item }) => (
            <View
              style={[
                styles.deviceCard,
                item.status === "Offline" && styles.deviceCardOffline,
                selectedDevice === item.ip && styles.deviceCardSelected,
              ]}
            >
              {/* Кнопка удаления (❌) */}
              <TouchableOpacity style={styles.deleteButton} onPress={() => removeDevice(item.ip)}>
                <Text style={styles.deleteButtonText}>✖</Text>
              </TouchableOpacity>

              {/* Контейнер с информацией */}
              <TouchableOpacity
                style={styles.deviceInfoContainer}
                onPress={() => selectDevice(item.ip)}
                disabled={item.status === "Offline"}
              >
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceText}>{item.location}</Text>
                <Text style={styles.deviceText}>{item.ip}</Text>
                <Text style={[styles.onlineText, item.status === "Offline" && styles.offlineText]}>
                  {item.status}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.noDevices}>Нет найденных устройств</Text>}
          scrollEnabled={false} // ✅ Отключаем встроенный скролл
        />
      </ScrollView>
    </View>
  </View>
);
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#1E1E2E", // Фон под цвет скриншота
      alignItems: "center",
      paddingTop: 50, // Отступ сверху
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 36,
      fontWeight: "bold",
      textAlign: "center",
      color: "#EAEAEA",
      marginBottom: 0,
    },
    titlesmall: {
      fontSize: 18,
      fontWeight: "bold",
      textAlign: "center",
      color: "#bbb",
      //color: "#EAEAEA",
      marginBottom: 20,
    },
    searchButton: {
      width: "100%",
      height: 50,
      backgroundColor: "#f9c154",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
      marginBottom: 20,
      flexDirection: "row",
    },

    searchButtonText: {
      fontSize: 18,
      fontWeight: "bold",
      color: "black",
      marginLeft: 5, // Отступ от иконки
    },
    statusText: {
      color: "gray",
      textAlign: "center",
      marginBottom: 10,
      fontSize: 14,
    },
    devicesContainer: {
      width: "100%",
      backgroundColor: "#1E1E2E", // Цвет контейнера списка устройств
      padding: 15,
      borderRadius: 10,
      borderWidth: 1, // Толщина границы
      borderColor: "#374151", // Цвет границы (серо-синий)
      marginBottom: 20, // Отступ снизу
    },
    devicesHeader: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#EAEAEA",
      textAlign: "center",
      marginBottom: 10,
    },
    deviceCard: {
      flexDirection: "row", // ✅ Располагаем элементы горизонтально
      padding: 15,
      borderRadius: 10,
      backgroundColor: "#282A36", // Цвет карточки устройства
      marginBottom: 10,
      borderWidth: 1, // Толщина границы
      borderColor: "#374151", // Цвет границы (серо-синий)
    },
    deviceCardOffline: {
      padding: 15,
      borderRadius: 10,
      backgroundColor: "#2E2E2E", // Серый цвет для неактивных устройств
      marginBottom: 10,
      opacity: 0.5, // Делаем неактивный эффект
    },
    deviceName: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#EAEAEA",
    },
    deviceText: {
      fontSize: 14,
      color: "#EAEAEA",
    },
    onlineText: {
      fontSize: 14,
      color: "#43A047",
      fontWeight: "bold",
    },
    offlineText: {
      fontSize: 14,
      color: "#E53935",
      fontWeight: "bold",
    },
    noDevices: {
      color: "gray",
      textAlign: "center",
      marginTop: 20,
    },
    deviceInfoContainer: {
        flex: 1, // ✅ Занимает всё доступное пространство
      },
      deviceSelectionMarker: {
        width: 8, // ✅ Толщина выделения
        height: "100%",
        backgroundColor: "#f9c154", // ✅ Цвет выделения
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },
      deleteButton: {
        position: "absolute",
        top: 5, // Прижимаем к верху
        right: 5, // Прижимаем вправо
        backgroundColor: "#1F2937", // Красный фон с легкой прозрачностью
        borderRadius: 8, // Делаем кнопку круглой
        width: 24,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10, // Размещаем поверх всего
      },
      
      deleteButtonText: {
        color: "#EAEAEA",
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "center",
        lineHeight: 18,  // Должно быть равно высоте кнопки
      },
  deviceCardSelected: {
    borderColor: "#f9c154", // Ярко-зелёный цвет рамки
    borderWidth: 2, // Увеличиваем толщину границы
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: "bold",
    color: "#EAEAEA",
  },
  });
  
  
export default HomeScreen;