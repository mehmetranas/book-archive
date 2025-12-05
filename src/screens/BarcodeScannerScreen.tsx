import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions, StatusBar, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
// We'll use simple vibration if heavy haptic lib is not installed, or try-catch it.
// Assuming we don't have react-native-haptic-feedback, we can use react-native's Vibration.
import { Vibration } from 'react-native';

const { width, height } = Dimensions.get('window');

// Cutout dimensions
const START_X = 40;
const START_Y = height / 2 - 100;
const SCAN_WIDTH = width - 80;
const SCAN_HEIGHT = 200;

export const BarcodeScannerScreen = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const device = useCameraDevice('back');
    const [hasPermission, setHasPermission] = useState(false);
    const [torch, setTorch] = useState<'off' | 'on'>('off');
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        (async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'granted');
        })();
    }, []);

    const onCodeScanned = useCallback((codes: any[]) => {
        if (!isScanning) return;

        const isbnCode = codes.find(code =>
            (code.type === 'ean-13' || code.type === 'ean-8' || code.type === 'upc-e' || code.type === 'upc-a') &&
            code.value
        );

        if (isbnCode) {
            setIsScanning(false);
            Vibration.vibrate();

            const scannedISBN = isbnCode.value;
            console.log("Scanned ISBN:", scannedISBN);

            // Navigate back to SearchScreen with the ISBN
            navigation.navigate('Search', { scannedIsbn: scannedISBN });
        }
    }, [isScanning, navigation]);

    // Use useCodeScanner from vision-camera
    const codeScanner = useCodeScanner({
        codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e'],
        onCodeScanned: onCodeScanned,
    });

    if (!hasPermission) {
        return (
            <View className="flex-1 items-center justify-center bg-black p-6">
                <Icon name="camera-off" size={64} color="#6B7280" />
                <Text className="text-white text-lg text-center mt-4 font-semibold">
                    {t('scanner.cameraPermissionRequired', 'Kamera izni gerekli')}
                </Text>
                <Text className="text-gray-400 text-center mt-2 mb-6">
                    {t('scanner.cameraPermissionDesc', 'Barkod taramak için lütfen kamera iznini etkinleştirin.')}
                </Text>
                <TouchableOpacity
                    onPress={() => Linking.openSettings()}
                    className="bg-blue-600 px-6 py-3 rounded-lg"
                >
                    <Text className="text-white font-bold">{t('scanner.openSettings', 'Ayarları Aç')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="mt-4"
                >
                    <Text className="text-gray-400 text-sm">{t('common.cancel', 'Vazgeç')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!device) {
        return (
            <View className="flex-1 items-center justify-center bg-black">
                <Text className="text-white">{t('scanner.notSupported', 'Kamera desteklenmiyor')}</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-black">
            <StatusBar barStyle="light-content" backgroundColor="black" />

            {isFocused && (
                <Camera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={isFocused}
                    codeScanner={codeScanner}
                    torch={torch}
                />
            )}

            {/* Overlay */}
            <View style={StyleSheet.absoluteFill}>
                {/* Top Overlay */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: START_Y, backgroundColor: 'rgba(0,0,0,0.6)' }} />

                {/* Bottom Overlay */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height - (START_Y + SCAN_HEIGHT), backgroundColor: 'rgba(0,0,0,0.6)' }} />

                {/* Left Overlay */}
                <View style={{ position: 'absolute', top: START_Y, left: 0, width: START_X, height: SCAN_HEIGHT, backgroundColor: 'rgba(0,0,0,0.6)' }} />

                {/* Right Overlay */}
                <View style={{ position: 'absolute', top: START_Y, right: 0, width: START_X, height: SCAN_HEIGHT, backgroundColor: 'rgba(0,0,0,0.6)' }} />

                {/* Center Cutout Border */}
                <View
                    style={{
                        position: 'absolute',
                        top: START_Y,
                        left: START_X,
                        width: SCAN_WIDTH,
                        height: SCAN_HEIGHT,
                        borderColor: 'white',
                        borderWidth: 2,
                        borderRadius: 16,
                        backgroundColor: 'transparent'
                    }}
                />
            </View>

            {/* UI Controls */}
            <View className="absolute top-12 left-4 z-50">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="bg-black/50 p-2 rounded-full"
                >
                    <Icon name="close" size={28} color="white" />
                </TouchableOpacity>
            </View>

            <View className="absolute top-12 right-4 z-50">
                <TouchableOpacity
                    onPress={() => setTorch(t => t === 'off' ? 'on' : 'off')}
                    className="bg-black/50 p-2 rounded-full"
                >
                    <Icon name={torch === 'on' ? 'flashlight' : 'flashlight-off'} size={28} color="white" />
                </TouchableOpacity>
            </View>

            <View className="absolute bottom-20 left-0 right-0 items-center">
                <Text className="text-white text-center font-medium bg-black/60 px-4 py-2 rounded-full overflow-hidden">
                    {t('scanner.hint', 'Barkodu karenin içine hizalayın')}
                </Text>
            </View>
        </View>
    );
};
