import React, { useState, useEffect, useCallback, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, ActionSheetIOS, Platform, AlertButton, RefreshControl, Share as RNShare, PermissionsAndroid, Modal, FlatList, Dimensions, TouchableWithoutFeedback } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../services/pocketbase';
import { Book } from './LibraryScreen';
import { AIStatusBadge } from '../components/AIStatusBadge';
import { CharacterCard } from '../components/CharacterCard';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GlobalBook {
    id: string;
    title: string;
    author?: string;
    character_analysis_status: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    character_map?: any;
}

// Extend Book interface locally if needed or update the main one
// Assuming Book is imported, we might need to cast or extend it here
// But better to update the main definition in LibraryScreen if possible.
// For now, let's just use 'any' casting in the component or update the import.
// Let's check where Book is defined. It is imported from './LibraryScreen'.
// We should update LibraryScreen.tsx to include expand.


export const BookDetailScreen = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const route = useRoute();
    const navigation = useNavigation();
    const queryClient = useQueryClient();
    const { bookId } = route.params as { bookId: string };

    useEffect(() => {
        const unsubscribe = pb.collection('books').subscribe(bookId, (e) => {
            if (e.action === 'update') {
                queryClient.invalidateQueries({ queryKey: ['book', bookId] });
                queryClient.invalidateQueries({ queryKey: ['books'] });
            }
        });

        return () => {
            unsubscribe.then((unsub) => unsub());
        };
    }, [bookId, queryClient]);

    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedAuthor, setEditedAuthor] = useState('');
    const [editedIsbn, setEditedIsbn] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [characterModalVisible, setCharacterModalVisible] = useState(false);
    const [optionsModalVisible, setOptionsModalVisible] = useState(false);
    const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const flatListRef = useRef<FlatList>(null);

    const { data: book, isLoading, refetch } = useQuery({
        queryKey: ['book', bookId],
        queryFn: async () => {
            return await pb.collection('books').getOne<Book>(bookId, { expand: 'character_map' });
        },
    });

    // Global Book Logic
    const { data: globalBook, refetch: refetchGlobalBook } = useQuery({
        queryKey: ['global_book', book?.title, book?.authors],
        queryFn: async () => {
            const title = book?.title;
            const author = book?.authors?.[0]; // İlk yazarı alıyoruz

            if (!title) return null;
            try {
                // Escape quotes in title to prevent filter syntax errors
                const safeTitle = title.replace(/"/g, '\\"');
                let filter = `title="${safeTitle}"`;

                if (author) {
                    const safeAuthor = author.replace(/"/g, '\\"');
                    filter += ` && author="${safeAuthor}"`;
                }

                return await pb.collection('global_books').getFirstListItem<GlobalBook>(filter);
            } catch (err: any) {
                return null;
            }
        },
        enabled: !!book?.title,
    });

    const analyzeCharacterMutation = useMutation({
        mutationFn: async () => {
            if (!book?.title) return;

            if (globalBook) {
                // Global kitap varsa, sadece ilişkiyi kur
                return await pb.collection('books').update(bookId, {
                    character_map: globalBook.id
                });
            } else {
                // Global kitap yoksa, analiz isteği oluştur (Cron Job yakalayacak)
                // Sadece status'u pending yapıyoruz, create işlemi yapmıyoruz.
                return await pb.collection('books').update(bookId, {
                    character_analysis_status: 'pending'
                });
            }
        },
        onSuccess: () => {
            refetchGlobalBook();
            queryClient.invalidateQueries({ queryKey: ['book', bookId] });
            Toast.show({
                type: 'success',
                text1: t('common.success'),
                text2: t('detail.analysisStarted', 'Analiz başlatıldı.'),
                position: 'top',
                visibilityTime: 3000,
            });
        },
        onError: (err: any) => {
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: err.message,
                position: 'bottom',
            });
        }
    });

    useEffect(() => {
        if (!book?.title) return;
        const unsubscribe = pb.collection('global_books').subscribe('*', (e) => {
            if (e.record.title === book.title) {
                queryClient.invalidateQueries({ queryKey: ['global_book', book.title] });
            }
        });
        return () => { unsubscribe.then((unsub) => unsub()); };
    }, [book?.title, queryClient]);

    // Invalidate cache on mount to ensure fresh data
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ['book', bookId] });
    }, [bookId, queryClient]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    useEffect(() => {
        if (book && !isEditing) {
            setEditedTitle(book.title || '');
            setEditedAuthor(Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors || ''));
            setEditedIsbn(book.isbn || '');
            setEditedDescription(book.description || '');
        }
    }, [book, isEditing]);

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<Book>) => {
            return await pb.collection('books').update(bookId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['book', bookId] });
            queryClient.invalidateQueries({ queryKey: ['books'] });
            setIsEditing(false);
            Toast.show({
                type: 'success',
                text1: t('common.success'),
                text2: t('detail.updateSuccess', 'Kitap güncellendi'),
                position: 'top',
            });
        },
        onError: (err: any) => {
            console.error('Update error:', err);
            const errorMessage = err?.data?.message || err?.message || t('detail.updateError', 'Güncelleme hatası');
            const validationErrors = err?.data?.data ? JSON.stringify(err.data.data, null, 2) : '';
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: errorMessage,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            return await pb.collection('books').delete(bookId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['books'] });
            navigation.goBack();
            Toast.show({
                type: 'success',
                text1: t('common.success'),
                text2: t('common.deleteSuccess', 'Kitap silindi'),
            });
        },
        onError: (err) => {
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('common.deleteError', 'Silme işlemi başarısız oldu.'),
            });
        }
    });

    const quoteMutation = useMutation({
        mutationFn: async () => {
            return await pb.collection('books').update(bookId, { image_gen_status: 'pending' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['book', bookId] });
            // No alert needed for this background action
        },
        onError: (err: any) => {
            console.error('Quote generation error:', err);
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('common.error'),
            });
        }
    });

    const handleDelete = () => {
        Alert.alert(
            t('common.delete', 'Sil'),
            t('common.deleteConfirmation', 'Bu kitabı silmek istediğinize emin misiniz?'),
            [
                { text: t('common.cancel', 'İptal'), style: 'cancel' },
                {
                    text: t('common.delete', 'Sil'),
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate()
                }
            ]
        );
    };

    const handleSave = () => {
        updateMutation.mutate({
            title: editedTitle,
            authors: editedAuthor.split(',').map(a => a.trim()).filter(a => a.length > 0),
            isbn: editedIsbn,
            description: editedDescription,
        });
    };

    const handleShare = async () => {
        if (!book) return;
        try {
            const authorText = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
            const message = `${book.title} - ${authorText}`;
            await RNShare.share({
                message: message,
            });
        } catch (error: any) {
            console.log('Share error:', error);
        }
    };

    const handleDownloadImage = async (imageUrl: string) => {
        if (!imageUrl) return;

        try {
            const { config, fs } = ReactNativeBlobUtil;
            const date = new Date();
            // Galeriye kaydetmek için PictureDir kullanıyoruzhj
            const fileDir = Platform.OS === 'ios' ? fs.dirs.DocumentDir : fs.dirs.PictureDir;
            const fileName = `BookVault_Quote_${Math.floor(date.getTime() + date.getSeconds() / 2)}.jpg`;
            const filePath = `${fileDir}/${fileName}`;

            // Android için izin kontrolü (Android 10 altı için gerekli olabilir)
            if (Platform.OS === 'android' && Platform.Version < 29) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    {
                        title: t('permissions.storageTitle', 'Depolama İzni'),
                        message: t('permissions.storageMessage', 'Resmi kaydetmek için depolama izni gerekiyor.'),
                        buttonNeutral: t('common.askLater', 'Daha Sonra Sor'),
                        buttonNegative: t('common.cancel', 'İptal'),
                        buttonPositive: t('common.ok', 'Tamam'),
                    },
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert(t('common.error'), t('permissions.storageDenied', 'Depolama izni reddedildi.'));
                    return;
                }
            }

            const configOptions = Platform.select({
                ios: {
                    fileCache: true,
                    path: filePath,
                    notification: true,
                },
                android: {
                    fileCache: true,
                    addAndroidDownloads: {
                        useDownloadManager: true,
                        notification: true,
                        path: filePath,
                        description: 'Downloading image...',
                        title: fileName,
                        mime: 'image/jpeg',
                        mediaScannable: true,
                    },
                },
            });

            if (!configOptions) return;

            config(configOptions)
                .fetch('GET', imageUrl)
                .then(async (res) => {
                    if (Platform.OS === 'ios') {
                        // iOS için galeriye kaydetme işlemi gerekebilir, şimdilik sadece indiriyor.
                        // react-native-cameraroll gerekebilir ama basitçe paylaşıma açabiliriz veya
                        // kullanıcıya indiğini bildirebiliriz.
                        // RNFetchBlob.ios.openDocument(res.data); // Dosyayı açar
                        ReactNativeBlobUtil.ios.previewDocument(res.data);
                    }
                    Alert.alert(t('common.success'), t('detail.imageDownloaded', 'Resim başarıyla indirildi.'));
                })
                .catch((errorMessage) => {
                    console.error(errorMessage);
                    Alert.alert(t('common.error'), t('common.downloadError', 'İndirme başarısız oldu.'));
                });

        } catch (error) {
            console.error('Image download error:', error);
            Alert.alert(t('common.error'), t('common.downloadError', 'İndirme başarısız oldu.'));
        }
    };

    const handleStatusChange = () => {
        const options = ['want_to_read', 'reading', 'read', 'cancel'];
        const labels = [
            t('status.wantToRead', 'Okunacak'),
            t('status.reading', 'Okunuyor'),
            t('status.read', 'Tamamlandı'),
            t('common.cancel', 'İptal')
        ];

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: labels,
                    cancelButtonIndex: 3,
                },
                (buttonIndex) => {
                    if (buttonIndex !== 3) {
                        updateMutation.mutate({ status: options[buttonIndex] });
                    }
                }
            );
        } else {
            // Android fallback using Alert
            const buttons: AlertButton[] = [
                ...options.slice(0, 3).map((opt, index) => ({
                    text: labels[index],
                    onPress: () => updateMutation.mutate({ status: opt })
                })),
                { text: labels[3], style: 'cancel', onPress: () => { } }
            ];

            Alert.alert(
                t('detail.changeStatus', 'Durumu Değiştir'),
                undefined,
                buttons
            );
        }
    };

    if (isLoading || !book) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    const coverUrl = book?.cover_url?.startsWith('http://')
        ? book.cover_url.replace('http://', 'https://')
        : book?.cover_url;

    // ... (existing code) ...

    // Helper to get characters

    // ... (existing code) ...

    // Helper to get characters
    const getCharacters = () => {
        // 1. Önce Relation (Global Book) üzerinden gelen veriye bak
        let relatedGlobalBook = book?.expand?.character_map;

        if (Array.isArray(relatedGlobalBook)) {
            relatedGlobalBook = relatedGlobalBook[0];
        }

        if (relatedGlobalBook) {
            const mapData = relatedGlobalBook.character_map;
            if (Array.isArray(mapData)) return mapData;
            // String ise parse et
            if (typeof mapData === 'string') {
                try {
                    const parsed = JSON.parse(mapData);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    // console.error('Global map parse error:', e); 
                }
            }
        }

        // 2. Yoksa Global Book sorgusundan gelen veriye bak
        if (globalBook?.character_map) {
            const mapData = globalBook.character_map;
            if (Array.isArray(mapData)) return mapData;
            if (typeof mapData === 'string') {
                try {
                    const parsed = JSON.parse(mapData);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) { }
            }
        }

        // 3. Fallback Local
        const localMap = book?.character_map as any;
        if (localMap && !localMap.id && typeof localMap !== 'string') {
            if (Array.isArray(localMap)) return localMap;
        }

        return null;
    };

    const characters = getCharacters();

    return (
        <View
            className="flex-1 bg-gray-50 dark:bg-gray-900"
            style={{ paddingTop: insets.top }}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm z-10">
                <TouchableOpacity
                    onPress={() => isEditing ? setIsEditing(false) : navigation.goBack()}
                    className="p-2"
                >
                    <Icon name={isEditing ? "close" : "arrow-left"} size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center" numberOfLines={1}>
                    {book.title}
                </Text>
                {isEditing ? (
                    <TouchableOpacity onPress={handleSave} className="p-2">
                        <Icon name="check" size={24} color="#2563EB" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => setOptionsModalVisible(true)} className="p-2">
                        <Icon name="dots-vertical" size={24} color="#374151" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                className="flex-1 p-4"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
                }
            >
                {/* Book Cover & Basic Info */}
                <View className="flex-row mb-6">
                    <View className="w-32 h-48 shadow-md mr-4">
                        {coverUrl ? (
                            <Image
                                source={{ uri: coverUrl }}
                                className="w-full h-full rounded-lg"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg items-center justify-center">
                                <Icon name="book-open-variant" size={40} color="#9CA3AF" />
                            </View>
                        )}
                    </View>

                    <View className="flex-1 justify-center">
                        {isEditing ? (
                            <View>
                                <TextInput
                                    className="text-xl font-bold text-gray-900 dark:text-white mb-2 border-b border-gray-300 pb-1"
                                    value={editedTitle}
                                    onChangeText={setEditedTitle}
                                    multiline
                                    placeholder={t('detail.titlePlaceholder', 'Kitap Adı')}
                                />
                                <TextInput
                                    className="text-gray-600 dark:text-gray-400 mb-2 border-b border-gray-300 pb-1"
                                    value={editedAuthor}
                                    onChangeText={setEditedAuthor}
                                    placeholder={t('detail.authorPlaceholder', 'Yazar')}
                                />
                                <TextInput
                                    className="text-gray-500 dark:text-gray-500 text-sm mb-4 border-b border-gray-300 pb-1"
                                    value={editedIsbn}
                                    onChangeText={setEditedIsbn}
                                    placeholder="ISBN"
                                    keyboardType="numeric"
                                />
                            </View>
                        ) : (
                            <View>
                                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                    {book.title}
                                </Text>
                                <Text className="text-gray-600 dark:text-gray-400 mb-1">
                                    {Array.isArray(book.authors) ? book.authors.join(', ') : book.authors}
                                </Text>
                                {book.isbn && (
                                    <Text className="text-gray-500 dark:text-gray-500 text-sm mb-4">
                                        ISBN: {book.isbn}
                                    </Text>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={handleStatusChange}
                            className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-lg self-start flex-row items-center"
                        >
                            <Text className="text-blue-700 dark:text-blue-300 font-medium mr-2">
                                {t(`status.${book.status}`, book.status)}
                            </Text>
                            <Icon name="chevron-down" size={16} color="#3B82F6" />
                        </TouchableOpacity>

                        <View className="mt-3">
                            <AIStatusBadge status={book.enrichment_status} showLabel={true} />
                        </View>
                    </View>
                </View>

                {/* Description Section */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                        {t('detail.description', 'Özet')}
                    </Text>

                    {(book.enrichment_status === 'pending' || book.enrichment_status === 'processing') ? (
                        <View className="items-center py-6 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700 border-dashed">
                            <ActivityIndicator size="small" color="#9333EA" />
                            <Text className="text-purple-600 dark:text-purple-400 font-medium mt-3 text-sm">
                                {t('detail.aiEnriching', 'Yapay zeka özeti hazırlıyor...')}
                            </Text>
                        </View>
                    ) : isEditing ? (
                        <TextInput
                            className="text-gray-600 dark:text-gray-300 text-base leading-6 min-h-[150px] border border-gray-200 rounded-lg p-2"
                            value={editedDescription}
                            onChangeText={setEditedDescription}
                            multiline
                            textAlignVertical="top"
                        />
                    ) : (
                        <Text className="text-gray-600 dark:text-gray-300 text-base leading-6">
                            {book.description || book.ai_notes || t('detail.noDescription', 'Henüz bir özet yok.')}
                        </Text>
                    )}
                </View>

                {/* Quote Image Section */}
                {(book.generated_image || book.image_gen_status === 'pending' || book.image_gen_status === 'processing') && (
                    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                            {t('detail.quoteImage', 'Alıntı Resim')}
                        </Text>

                        {(book.image_gen_status === 'pending' || book.image_gen_status === 'processing') ? (
                            <View className="aspect-square w-full bg-gray-50 dark:bg-gray-700/30 rounded-lg items-center justify-center border border-gray-200 dark:border-gray-700 border-dashed">
                                <ActivityIndicator size="large" color="#DB2777" />
                                <Text className="text-pink-600 dark:text-pink-400 font-medium mt-4">
                                    {t('detail.generatingImage', 'Resim oluşturuluyor...')}
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View className="aspect-square w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow-sm">
                                    <Image
                                        source={{ uri: pb.files.getURL(book, book.generated_image || '') }}
                                        className="w-full h-full"
                                        resizeMode="contain"
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = pb.files.getURL(book, book.generated_image || '');
                                        handleDownloadImage(url);
                                    }}
                                    className="mt-3 flex-row items-center justify-center bg-gray-100 dark:bg-gray-700 py-2 rounded-lg"
                                >
                                    <Icon name="download" size={18} color="#4B5563" />
                                    <Text className="ml-2 text-gray-600 dark:text-gray-300 font-medium">
                                        {t('common.download', 'İndir')}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}

                {/* Character Analysis Section */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-20">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('detail.characters', 'Karakter Analizi')}
                        </Text>

                    </View>

                    {(() => {
                        const globalStatus = globalBook?.character_analysis_status;
                        const hasLocalMap = book.character_map && book.character_map.length > 0;
                        let status = globalStatus || 'none';

                        // Fallback mechanism
                        if ((!status || status === 'none') && hasLocalMap) {
                            status = 'completed';
                        }

                        if (status === 'none' || status === 'failed') {
                            return (
                                <View className="items-center py-6">
                                    <Icon name="head-snowflake-outline" size={48} color="#E0E7FF" />
                                    <Text className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-4 px-4">
                                        {t('detail.characterAnalysisDesc', 'Yapay zeka bu kitabı okuyarak karakter haritası çıkarabilir.')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => analyzeCharacterMutation.mutate()}
                                        className="bg-indigo-600 px-6 py-3 rounded-xl flex-row items-center"
                                        disabled={analyzeCharacterMutation.isPending}
                                    >
                                        <Icon name="creation" size={20} color="white" className="mr-2" />
                                        <Text className="text-white font-bold ml-2">
                                            {status === 'failed' ? t('common.retry', 'Tekrar Dene') : t('detail.analyzeCharacters', 'Karakterleri Analiz Et')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        } else if (status === 'pending' || status === 'processing') {
                            return (
                                <View className="items-center py-8">
                                    <ActivityIndicator size="large" color="#4F46E5" />
                                    <Text className="text-indigo-600 dark:text-indigo-400 font-medium mt-4">
                                        {t('detail.analyzing', 'Yapay zeka kitabı okuyor...')}
                                    </Text>
                                    <Text className="text-gray-400 text-xs mt-1">
                                        {t('detail.pleaseWait', 'Lütfen bekleyin, bu işlem birkaç dakika sürebilir.')}
                                    </Text>
                                </View>
                            );
                        } else {
                            // Completed
                            if (characters && characters.length > 0) {
                                return (
                                    <View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 py-2">
                                            {characters.map((char: any, index: number) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() => {
                                                        setSelectedCharacterIndex(index);
                                                        setCharacterModalVisible(true);
                                                    }}
                                                >
                                                    <CharacterCard character={char} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedCharacterIndex(0);
                                                setCharacterModalVisible(true);
                                            }}
                                            className="mt-3 flex-row items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 py-2 rounded-lg"
                                        >
                                            <Icon name="fullscreen" size={18} color="#4F46E5" />
                                            <Text className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium">
                                                {t('detail.viewFullScreen', 'Tam Ekran Görüntüle')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            } else {
                                return (
                                    <View className="items-center py-4 opacity-60">
                                        <Text className="text-gray-500 dark:text-gray-400">
                                            {t('detail.noCharactersFound', 'Bu kitapta belirgin bir karakter bulunamadı.')}
                                        </Text>
                                    </View>
                                );
                            }
                        }
                    })()}
                </View>
            </ScrollView>

            {/* Full Screen Character Modal */}
            <Modal
                visible={characterModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setCharacterModalVisible(false)}
            >
                <View className="flex-1 bg-gray-50 dark:bg-gray-900">
                    {/* Modal Header */}
                    <View className="flex-row items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('detail.characters', 'Karakter Analizi')}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setCharacterModalVisible(false)}
                            className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full"
                        >
                            <Icon name="close" size={20} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    {/* Character Pager */}
                    <FlatList
                        ref={flatListRef}
                        data={characters || []}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={selectedCharacterIndex}
                        onMomentumScrollEnd={(ev) => {
                            const newIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                            setSelectedCharacterIndex(newIndex);
                        }}
                        getItemLayout={(data, index) => (
                            { length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }
                        )}
                        renderItem={({ item }) => (
                            <View style={{ width: SCREEN_WIDTH }} className="p-4">
                                <ScrollView className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
                                    {/* Header: Name & Role */}
                                    <View className="items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-6">
                                        <View className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900 rounded-full items-center justify-center mb-4">
                                            <Text className="text-3xl font-bold text-indigo-600 dark:text-indigo-300">
                                                {item.name.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-2">
                                            {item.name}
                                        </Text>
                                        <Text className="text-xl font-medium text-indigo-600 dark:text-indigo-400 text-center">
                                            {item.role}
                                        </Text>
                                    </View>

                                    {/* Traits */}
                                    <View className="mb-6">
                                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                            {t('character.traits', 'Özellikler')}
                                        </Text>
                                        <View className="flex-row flex-wrap gap-2">
                                            {item.traits && item.traits.map((trait: string, idx: number) => (
                                                <View key={idx} className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                                                    <Text className="text-base text-gray-700 dark:text-gray-300">
                                                        {trait}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Relationships */}
                                    {item.relationships && item.relationships.length > 0 && (
                                        <View className="mb-6">
                                            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                                {t('character.relations', 'İlişkiler')}
                                            </Text>
                                            {item.relationships && item.relationships.map((rel: any, idx: number) => (
                                                <View key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-3 border border-gray-100 dark:border-gray-700">
                                                    <View className="flex-row items-center mb-1">
                                                        <Icon name="account-arrow-right" size={20} color="#6366F1" className="mr-2" />
                                                        <Text className="text-lg font-bold text-gray-800 dark:text-gray-200 ml-2">
                                                            {rel.target}
                                                        </Text>
                                                    </View>
                                                    <Text className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1 ml-7">
                                                        {rel.type}
                                                    </Text>
                                                    {rel.details && (
                                                        <Text className="text-gray-600 dark:text-gray-400 ml-7 leading-5">
                                                            {rel.details}
                                                        </Text>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Bottom Spacer */}
                                    <View className="h-10" />
                                </ScrollView>
                            </View>
                        )}
                    />

                    {/* Pagination Dots */}
                    <View className="flex-row justify-center pb-8 pt-2 bg-gray-50 dark:bg-gray-900">
                        {characters && characters.map((_, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                    setSelectedCharacterIndex(idx);
                                    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                                }}
                                className={`w-2 h-2 rounded-full mx-1 ${idx === selectedCharacterIndex ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            />
                        ))}
                    </View>
                </View>
            </Modal>

            {/* Options Bottom Sheet Modal */}
            <Modal
                visible={optionsModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setOptionsModalVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
                    activeOpacity={1}
                    onPress={() => setOptionsModalVisible(false)}
                >
                    <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl p-6 pb-10 shadow-xl">
                        <View className="items-center mb-4">
                            <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                        </View>

                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                            {t('common.options', 'Seçenekler')}
                        </Text>

                        <View>
                            {/* Edit */}
                            <TouchableOpacity
                                onPress={() => { setOptionsModalVisible(false); setIsEditing(true); }}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl mb-3 flex-row items-center"
                            >
                                <Icon name="pencil" size={22} color="#2563EB" />
                                <Text className="ml-3 font-medium text-gray-700 dark:text-gray-200">{t('common.edit', 'Düzenle')}</Text>
                            </TouchableOpacity>

                            {/* Library Toggle */}
                            <TouchableOpacity
                                onPress={() => { setOptionsModalVisible(false); updateMutation.mutate({ in_library: !book.in_library }); }}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl mb-3 flex-row items-center"
                            >
                                <Icon name="bookshelf" size={22} color={book.in_library ? "#166534" : "#4B5563"} />
                                <Text className="ml-3 font-medium text-gray-700 dark:text-gray-200">
                                    {book.in_library ? t('detail.removeFromLib', 'Kütüphaneden Çıkar') : t('detail.addToLib', 'Kütüphaneye Ekle')}
                                </Text>
                            </TouchableOpacity>

                            {/* Archive Toggle */}
                            <TouchableOpacity
                                onPress={() => { setOptionsModalVisible(false); updateMutation.mutate({ is_archived: !book.is_archived }); }}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl mb-3 flex-row items-center"
                            >
                                <Icon name="archive" size={22} color={book.is_archived ? "#C2410C" : "#4B5563"} />
                                <Text className="ml-3 font-medium text-gray-700 dark:text-gray-200">
                                    {book.is_archived ? t('detail.unarchive', 'Arşivden Çıkar') : t('detail.archive', 'Arşivle')}
                                </Text>
                            </TouchableOpacity>

                            {/* Share */}
                            <TouchableOpacity
                                onPress={() => { setOptionsModalVisible(false); handleShare(); }}
                                className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-xl mb-3 flex-row items-center"
                            >
                                <Icon name="share-variant" size={22} color="#4B5563" />
                                <Text className="ml-3 font-medium text-gray-700 dark:text-gray-200">{t('common.share', 'Paylaş')}</Text>
                            </TouchableOpacity>

                            {/* AI Regenerate */}
                            <TouchableOpacity
                                onPress={() => { setOptionsModalVisible(false); updateMutation.mutate({ enrichment_status: 'pending' }); }}
                                className="w-full bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl mb-3 flex-row items-center"
                            >
                                <Icon name="creation" size={22} color="#9333EA" />
                                <Text className="ml-3 font-medium text-purple-700 dark:text-purple-300">{t('detail.regenerateAI', 'Yapay Zeka Analizini Yenile')}</Text>
                            </TouchableOpacity>

                            {/* Quote Image (Disabled) */}
                            <TouchableOpacity
                                disabled={true}
                                onPress={() => { }}
                                className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-xl mb-3 flex-row items-center opacity-60"
                            >
                                <Icon name="lock" size={22} color="#9CA3AF" />
                                <Text className="ml-3 font-medium text-gray-500 dark:text-gray-400">
                                    {t('detail.quoteImage', 'Alıntı Resmi Oluştur')}
                                    <Text className="text-xs text-gray-400"> (Geçici Kapalı)</Text>
                                </Text>
                            </TouchableOpacity>

                            {/* Delete */}
                            <TouchableOpacity
                                onPress={() => { setOptionsModalVisible(false); handleDelete(); }}
                                className="w-full bg-red-50 dark:bg-red-900/20 p-4 rounded-xl flex-row items-center"
                            >
                                <Icon name="trash-can-outline" size={22} color="#DC2626" />
                                <Text className="ml-3 font-bold text-red-600 dark:text-red-400">{t('common.delete', 'Kitabı Sil')}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => setOptionsModalVisible(false)}
                            className="mt-2 p-3 items-center"
                        >
                            <Text className="text-gray-500 font-medium">{t('common.cancel', 'İptal')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View >
    );
};
