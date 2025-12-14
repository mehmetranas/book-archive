import React, { useState, useEffect, useCallback, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, ActionSheetIOS, Platform, AlertButton, RefreshControl, Share, PermissionsAndroid, Modal, FlatList, Dimensions, TouchableWithoutFeedback } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import ViewShot from 'react-native-view-shot';

import { useRoute, useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
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

interface GeneratedContentItem {
    id: string;
    quote: string;
    imagePrompt: string;
    image: string | null;
    createdAt: string;
}

// Extend Book interface locally if needed or update the main one
// Assuming Book is imported, we might need to cast or extend it here
// But better to update the main definition in LibraryScreen if possible.
// For now, let's just use 'any' casting in the component or update the import.
// Let's check where Book is defined. It is imported from './LibraryScreen'.
// We should update LibraryScreen.tsx to include expand.

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const BookDetailScreen = () => {
    const { t } = useTranslation();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
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

    // AI Slider Stores
    const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

    // Refs for capturing screenshots of each slide
    const viewShotRefs = useRef<{ [key: string]: ViewShot | null }>({});
    const flatListQuoteRef = useRef<FlatList>(null);

    const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0); // Existing line

    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const flatListRef = useRef<FlatList>(null);

    const { data: book, isLoading, refetch } = useQuery({
        queryKey: ['book', bookId],
        queryFn: async () => {
            return await pb.collection('books').getOne<Book>(bookId, { expand: 'character_map' });
        },
    });

    // Sayfa yuklendiginde veya kitap guncellendiginde, eger kayitli resim varsa onu goster
    // Old useEffect for generatedImage removed (now using generated_content array)

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
            await Share.share({
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
                    <Icon name={isEditing ? "close" : "arrow-left"} size={24} color={isDark ? "#F3F4F6" : "#374151"} />
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
                        <Icon name="dots-vertical" size={24} color={isDark ? "#F3F4F6" : "#374151"} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
                }
            >
                {/* Book Cover & Basic Info */}
                <View className="flex-row mb-6 mx-4 mt-4">
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

                        {book.enrichment_status !== 'completed' && (
                            <View className="mt-3">
                                <AIStatusBadge status={book.enrichment_status} showLabel={true} />
                            </View>
                        )}
                    </View>
                </View>

                {/* Description Section */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6 mx-4">
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

                    {/* Tags Section */}
                    {book.tags && book.tags.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            {book.tags.map((tag, index) => (
                                <View key={index} className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">
                                    <Text className="text-xs font-medium text-blue-600 dark:text-blue-300">
                                        #{tag}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* --- AI Content Gallery (Slider) --- */}
                <View className="mb-6">
                    <View className="flex-row items-center justify-between mb-4 mx-4">
                        <Text className="text-xl font-bold text-gray-900 dark:text-white">
                            {t('detail.gallery', 'Alıntılar & Galeri')}
                        </Text>
                        <TouchableOpacity
                            onPress={async () => {
                                try {
                                    setQuoteLoading(true);
                                    const res = await pb.send("/api/ai/quote", { body: { id: book.id }, method: 'POST' });
                                    console.log("Quote response:", res);

                                    queryClient.invalidateQueries({ queryKey: ['book', book.id] });

                                    // Slider'ı en son eklenen öğeye kaydır
                                    if (res.newItem && typeof res.newItem === 'object') {
                                        // Bekleme süresi gerekebilir, UI render olduktan sonra
                                        setTimeout(() => {
                                            // FlatList'i sona kaydır (Eğer ref varsa)
                                        }, 500);
                                    }

                                    Toast.show({ type: 'success', text1: 'Yeni taslak eklendi!' });

                                    // Scroll to end (new item) after a small delay
                                    setTimeout(() => {
                                        // We can't easily know the exact index without data reload, bu we can try scrolling to end
                                        // or just let user see it.
                                        // Better: Just toast
                                        Toast.show({ type: 'success', text1: 'Yeni taslak eklendi!' });
                                    }, 100);

                                } catch (e: any) {
                                    console.log("Quote Gen Error:", e);
                                    const errorMsg = e?.data?.error || e?.message || "Bilinmeyen hata";
                                    Alert.alert("Hata", `Alıntı üretilemedi: ${errorMsg}`);
                                } finally {
                                    setQuoteLoading(false);
                                }
                            }}
                            disabled={quoteLoading || (book.enrichment_status === 'pending' || book.enrichment_status === 'processing')}
                            className={`px-4 py-2 rounded-full flex-row items-center ${(quoteLoading || book.enrichment_status === 'pending' || book.enrichment_status === 'processing') ? 'bg-gray-100 dark:bg-gray-800 opacity-50' : 'bg-purple-600'}`}
                        >
                            {quoteLoading ? (
                                <ActivityIndicator size="small" color="#9333EA" />
                            ) : (
                                <>
                                    <Icon name="plus" size={16} color="white" className="mr-1" />
                                    <Text className="text-white font-medium text-sm">
                                        {t('detail.newDraft', 'Yeni')}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Content Slider */}
                    {(() => {
                        const contentList = ((book as any)?.generated_content || []) as GeneratedContentItem[];
                        const reverseList = [...contentList].reverse(); // Show newest first? Or oldest? Usually newest first is better for 'Drafts'. Let's keep original order (oldest first) so user scrolls to see new ones? Or reverse?
                        // User request: "slide olacak". Usually like a carousel.
                        // Let's use Reverse (Newest First) so they see what they just created.

                        if (contentList.length === 0) {
                            return (
                                <View className="items-center justify-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 mx-4">
                                    <Icon name="image-album" size={48} color="#9CA3AF" />
                                    <Text className="text-gray-500 dark:text-gray-400 mt-3 text-center px-6">
                                        {t('detail.noContent', 'Henüz oluşturulmuş bir alıntı kartı yok. "Yeni" butonuna basarak kitapdan etkileyici bir söz seçin.')}
                                    </Text>
                                </View>
                            );
                        }

                        // Slider logic
                        return (
                            <View style={{ width: SCREEN_WIDTH }}>
                                <FlatList
                                    ref={flatListQuoteRef}
                                    data={reverseList}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    snapToInterval={SCREEN_WIDTH}
                                    decelerationRate="fast"
                                    keyExtractor={(item) => item.id}
                                    contentContainerStyle={{ paddingHorizontal: 0 }}
                                    onMomentumScrollEnd={(ev) => {
                                        const newIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                                        setActiveQuoteIndex(newIndex);
                                    }}
                                    renderItem={({ item, index }) => {
                                        const hasImage = !!item.image;
                                        const imageUrl = hasImage ? `${pb.baseUrl}/api/files/${book.collectionId}/${book.id}/${item.image}` : null;

                                        return (
                                            <View style={{ width: SCREEN_WIDTH }} className="justify-center items-center">
                                                {/* Card Container */}
                                                <View style={{ width: SCREEN_WIDTH - 32 }} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm relative">

                                                    {/* Image or Placeholder Area */}
                                                    <ViewShot
                                                        ref={(ref) => { viewShotRefs.current[item.id] = ref; }}
                                                        options={{ format: "jpg", quality: 0.9 }}
                                                        style={{ backgroundColor: isDark ? '#1F2937' : '#ffffff', width: '100%' }}
                                                    >
                                                        {/* Full Aspect Square Container */}
                                                        <View className="relative w-full aspect-square bg-gray-900 overflow-hidden">
                                                            {/* Background Image */}
                                                            {hasImage && imageUrl ? (
                                                                <Image
                                                                    source={{ uri: imageUrl }}
                                                                    className="w-full h-full absolute inset-0"
                                                                    resizeMode="cover"
                                                                />
                                                            ) : (
                                                                // Placeholder Gradient Background if no image
                                                                <View className="w-full h-full absolute inset-0 bg-transparent">
                                                                    <View className="absolute inset-0 bg-purple-900" />
                                                                    <View className="absolute top-0 right-0 w-64 h-64 bg-purple-600 rounded-full blur-3xl opacity-50" />
                                                                    <View className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-50" />
                                                                </View>
                                                            )}

                                                            {/* Dark Overlay for Readability */}
                                                            <View className="absolute inset-0 bg-black/40" />

                                                            {/* Inner Content Container */}
                                                            <View className="absolute inset-0 items-center justify-center p-8">

                                                                {/* Border Frame */}
                                                                <View className="w-full h-full border border-white/30 rounded-3xl p-4 relative">

                                                                    {/* Flex Container for Content */}
                                                                    <View className="flex-1 items-center justify-center">

                                                                        {/* Top Quote Icon */}
                                                                        <Icon name="format-quote-open" size={32} color="rgba(255,255,255,0.8)" className="mb-2" />

                                                                        {/* Quote Text - Dynamic Size */}
                                                                        <Text
                                                                            className={`text-white text-center font-serif italic shadow-sm px-2 ${item.quote.length > 300 ? 'text-xs leading-4' :
                                                                                item.quote.length > 200 ? 'text-sm leading-5' :
                                                                                    item.quote.length > 100 ? 'text-lg leading-7' :
                                                                                        'text-xl leading-8'
                                                                                }`}
                                                                        >
                                                                            "{item.quote}"
                                                                        </Text>

                                                                        {/* Bottom Quote Icon */}
                                                                        <Icon name="format-quote-close" size={32} color="rgba(255,255,255,0.8)" className="mt-2" />

                                                                    </View>

                                                                    {/* Author Section - Fixed at Bottom with padding */}
                                                                    <View className="w-full flex-row items-center justify-center pt-4 pb-2">
                                                                        <View className="h-[1px] bg-white/40 flex-1 max-w-[40px] mr-3" />
                                                                        <View className="items-center justify-center max-w-[200px]">
                                                                            <Text className="text-white/90 text-[10px] font-bold uppercase tracking-[2px] text-center" numberOfLines={1}>
                                                                                {book.authors?.[0] || 'Unknown'}
                                                                            </Text>
                                                                            <Text className="text-white/70 text-[9px] font-medium tracking-wide text-center mt-1" numberOfLines={1}>
                                                                                {book.title}
                                                                            </Text>
                                                                        </View>
                                                                        <View className="h-[1px] bg-white/40 flex-1 max-w-[40px] ml-3" />
                                                                    </View>

                                                                </View>
                                                            </View>
                                                        </View>

                                                        {/* No extra text view below since it's all overlay now */}
                                                    </ViewShot>

                                                    {/* Action Buttons */}
                                                    <View className="p-4 border-t border-gray-100 dark:border-gray-700 flex-row gap-3">
                                                        {hasImage ? (
                                                            <TouchableOpacity
                                                                className="flex-1 bg-gray-900 dark:bg-white py-3 rounded-xl flex-row items-center justify-center shadow-sm"
                                                                onPress={async () => {
                                                                    try {
                                                                        const uri = await viewShotRefs.current[item.id]?.capture();
                                                                        if (uri) {
                                                                            await Share.share({ url: uri });
                                                                        }
                                                                    } catch (e) {
                                                                        console.log(e);
                                                                    }
                                                                }}
                                                            >
                                                                <Icon name="share-variant" size={18} color={isDark ? "black" : "white"} className="mr-2" />
                                                                <Text className={`font-bold ${isDark ? 'text-gray-900' : 'text-white'}`}>
                                                                    {t('common.share', 'Paylaş')}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ) : (
                                                            <TouchableOpacity
                                                                className={`flex-1 py-3 rounded-xl flex-row items-center justify-center shadow-lg dark:shadow-none ${loadingItems[item.id] ? 'bg-gray-100 dark:bg-gray-800' : 'bg-purple-600 shadow-purple-200'}`}
                                                                disabled={loadingItems[item.id]}
                                                                onPress={async () => {
                                                                    const imagePrompt = item.imagePrompt;
                                                                    if (!imagePrompt) return;

                                                                    try {
                                                                        // Set loading only for this item
                                                                        setLoadingItems(prev => ({ ...prev, [item.id]: true }));
                                                                        console.log("Requesting image for content:", item.id);

                                                                        const res = await pb.send("/api/ai/quote-image-v2", {
                                                                            body: {
                                                                                id: book.id,
                                                                                contentId: item.id
                                                                            },
                                                                            method: 'POST'
                                                                        });
                                                                        console.log("Image Gen Res:", res);

                                                                        // 1. Manuel Cache Update (Instant Feedback)
                                                                        if (res.fileName) {
                                                                            queryClient.setQueryData(['book', book.id], (oldData: any) => {
                                                                                if (!oldData) return oldData;
                                                                                // Clone generated_content
                                                                                const newContent = oldData.generated_content.map((c: any) => {
                                                                                    if (c.id === item.id) {
                                                                                        return { ...c, image: res.fileName };
                                                                                    }
                                                                                    return c;
                                                                                });
                                                                                return { ...oldData, generated_content: newContent };
                                                                            });
                                                                        }

                                                                        // 2. Invalidate to be sure (background refetch)
                                                                        queryClient.invalidateQueries({ queryKey: ['book', book.id] });
                                                                        Toast.show({ type: 'success', text1: 'Görsel oluşturuldu!' });

                                                                    } catch (e: any) {
                                                                        console.error("Quote Image Error:", e);
                                                                        const errMsg = e?.data?.error || e?.message || JSON.stringify(e);
                                                                        Alert.alert("Hata", `Görsel üretilemedi: ${errMsg}`);
                                                                    } finally {
                                                                        // Clear loading
                                                                        setLoadingItems(prev => ({ ...prev, [item.id]: false }));
                                                                    }
                                                                }}
                                                            >
                                                                {loadingItems[item.id] ? (
                                                                    <>
                                                                        <ActivityIndicator size="small" color="#9333EA" className="mr-2" />
                                                                        <Text className="text-gray-500 dark:text-gray-400 font-medium text-xs">
                                                                            İşleniyor...
                                                                        </Text>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Icon name="palette" size={18} color="white" className="mr-2" />
                                                                        <Text className="font-bold text-white">
                                                                            {t('detail.visualize', 'Görselleştir')}
                                                                        </Text>
                                                                    </>
                                                                )}
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* Page Indicator */}
                                                <View className="flex-row justify-center mt-4 mb-2">
                                                    <Text className="text-xs text-gray-400 font-medium">
                                                        {index + 1} / {reverseList.length}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    }}
                                />
                            </View>
                        );
                    })()}
                </View>


                {/* Character Analysis Section */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-20 mx-4">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('detail.characters', 'Karakter Analizi')}
                        </Text>

                    </View>

                    {(() => {
                        // Check multiple sources for status
                        const mutationPending = analyzeCharacterMutation.isPending;
                        const globalStatus = globalBook?.character_analysis_status;
                        const localStatus = book.character_analysis_status;
                        const hasLocalMap = book.character_map && book.character_map.length > 0;

                        // Priority: Mutation (Immediate UI) -> Local (DB) -> Global (DB) -> None
                        let status = mutationPending ? 'pending' :
                            (localStatus === 'pending' || localStatus === 'processing' ? localStatus :
                                (globalStatus || 'none'));

                        // Fallback mechanism
                        if ((!status || status === 'none') && hasLocalMap) {
                            status = 'completed';
                        }

                        if (status === 'none' || status === 'failed') {
                            return (
                                <View className="items-center py-6">
                                    <Icon name="account-group-outline" size={48} color="#E0E7FF" />
                                    <Text className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-4 px-4">
                                        {t('detail.characterAnalysisDesc', 'Kitabın detaylı karakter haritasını ve ilişkilerini keşfedin.')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => analyzeCharacterMutation.mutate()}
                                        className={`bg-indigo-600 px-6 py-3 rounded-xl flex-row items-center ${(book.enrichment_status === 'pending' || book.enrichment_status === 'processing') ? 'opacity-50' : ''}`}
                                        disabled={analyzeCharacterMutation.isPending || (book.enrichment_status === 'pending' || book.enrichment_status === 'processing')}
                                    >
                                        <Icon name="account-search-outline" size={20} color="white" className="mr-2" />
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
                                        {t('detail.analyzing', 'Karakterler ve ilişkiler inceleniyor...')}
                                    </Text>
                                    <Text className="text-gray-400 text-xs mt-1 text-center px-4">
                                        {t('detail.pleaseWait', 'Lütfen bekleyin, bu işlem birkaç dakika sürebilir.')}
                                    </Text>

                                    <TouchableOpacity
                                        onPress={() => analyzeCharacterMutation.mutate()}
                                        className="mt-4 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg"
                                    >
                                        <Text className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('detail.stuck', 'Takıldı mı? Tekrar Dene')}
                                        </Text>
                                    </TouchableOpacity>
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
            </ScrollView >

            {/* Full Screen Character Modal */}
            < Modal
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
            </Modal >

            {/* Options Bottom Sheet Modal */}
            < Modal
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


                            {/* Quote Image (Disabled) */}


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
            </Modal >
        </View >
    );
};
