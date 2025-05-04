import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, ScrollView, View, TextInput, TouchableOpacity, Image, Alert, ToastAndroid, ActivityIndicator, PermissionsAndroid } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from "axios";
import * as Clipboard from 'expo-clipboard';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons, FontAwesome, MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Switch } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Voice from "@react-native-voice/voice";
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av'; // Changed from * as Audio
import { OPENAI_API_KEY, OPENAI_API_URL } from '@env';



// Call the API
console.log(OPENAI_API_KEY);

// Create a theme context
const ThemeContext = createContext({
  isDarkMode: false,
  toggleTheme: () => {},
  fontSize: 16,
  setAppFontSize: () => {},
  theme: {
    backgroundColor: '#A2D2FF',
    textColor: 'black',
    cardColor: 'white',
    navBarColor: '#F4A261',
    rowColor: '#000000',
    buttonsColor: '#F4A261',
  },
});

// Create drawer navigator
const Drawer = createDrawerNavigator();
console.log('API KEY:', OPENAI_API_KEY);
console.log('API URL:', OPENAI_API_URL);


const translateTextWithOpenAI = async (inputText, sourceLang, targetLang, setTranslatedText) => {
  if (!inputText.trim()) {
    Alert.alert("Error", "Please enter text to translate.");
    return;
  }

  try {
    console.log("API Key starts with:", OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 3)}...` : "undefined");

    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a translation assistant." },
        { role: "user", content: `Translate '${inputText}' from ${sourceLang} to ${targetLang}. Give only the translation.` }
      ],
      max_tokens: 1000,
    };

    const response = await axios.post(OPENAI_API_URL, requestBody, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    });

    setTranslatedText(response.data.choices[0].message.content.trim());
  } catch (error) {
    console.error("Translation error details:", error.response ? error.response.data : error.message);
    Alert.alert("Error", "Failed to translate text.");
  }
};

// Main Translation Screen Component
function TranslationScreen() {
  const [selectedLanguage1, setSelectedLanguage1] = useState("English")
  const [selectedLanguage2, setSelectedLanguage2] = useState("Tagalog")
  const [text, setText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const navigation = useNavigation()
  const { theme, isDarkMode, fontSize } = useContext(ThemeContext)

  // Whisper API integration
  const [recording, setRecording] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)

  // SECURITY WARNING: Never include API keys directly in your code
  // Use environment variables or a secure storage solution

    async function requestAudioPermission() {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return false;
          }
        }
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
      } catch (e) {
        console.error("Permission error:", e);
        return false;
      }
    }
    

  useEffect(() => {
    if (Voice) {
      Voice.onSpeechResults = onSpeechResultsHandler
    }
    return () => {
      if (Voice) {
        Voice.destroy().then(Voice.removeAllListeners)
      }
    }
  }, [])

  const onSpeechResultsHandler = (e) => {
    if (e.value && e.value.length > 0) {
      const spokenText = e.value[0]
      setText(spokenText)
      console.log("Recognized text:", spokenText)
      // Optionally auto-translate after recognition
      // translateTextWithOpenAI(spokenText, selectedLanguage1, selectedLanguage2, setTranslatedText);
    }
  }

  // Whisper API recording functions
  async function startWhisperRecording() {
    try {
      console.log("Requesting permissions...")

      // Request permission
      const permissionGranted = await requestAudioPermission()
      if (!permissionGranted) {
        return
      }

      console.log("Setting audio mode...")
      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })

      console.log("Starting recording...")
      // Create a recording
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)

      setRecording(recording)
      ToastAndroid.show("Recording with Whisper...", ToastAndroid.SHORT)
    } catch (err) {
      console.error("Failed to start recording", err)
      Alert.alert("Error", "Failed to start recording")
    }
  }

  async function stopWhisperRecording() {
    console.log("Stopping recording...")

    if (!recording) {
      console.log("No recording to stop")
      return null
    }

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      console.log("Recording stopped and stored at", uri)
      setRecording(null)
      return uri
    } catch (error) {
      console.error("Error stopping recording:", error)
      return null
    }
  }

  async function transcribeWithWhisper(audioUri) {
    if (!audioUri) {
      console.error("No audio URI provided for transcription")
      return
    }

    setIsTranscribing(true)
    ToastAndroid.show("Transcribing with Whisper...", ToastAndroid.SHORT)

    try {
      console.log("Preparing to transcribe audio from:", audioUri)

      // Create form data for the API request
      const formData = new FormData()
      formData.append("file", {
        uri: audioUri,
        type: "audio/m4a",
        name: "recording.m4a",
      })
      formData.append("model", "whisper-1")

      console.log("Sending audio to OpenAI API...")

      // Send to OpenAI Whisper API
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${YOUR_OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error Response:", errorText)
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log("Transcription received:", data)

      // Set the transcribed text to the input field
      setText(data.text)

      // Translation will happen automatically due to the useEffect
    } catch (error) {
      console.error("Error transcribing audio:", error)
      Alert.alert("Transcription Error", "Failed to transcribe audio. Please try again.")
    } finally {
      setIsTranscribing(false)
    }
  }

  const startListening = async () => {
    // If already recording with Whisper, stop and transcribe
    if (recording) {
      const audioUri = await stopWhisperRecording()
      if (audioUri) {
        await transcribeWithWhisper(audioUri)
      }
      return
    }

    // Show options dialog
    Alert.alert("Voice Recognition", "Choose a recognition method:", [
      {
        text: "Basic (Fast)",
        onPress: async () => {
          try {
            // First request permission
            await requestAudioPermission()

            if (Voice) {
              // Stop any ongoing recording first
              await Voice.stop()
              // Start listening in the language of the source text
              const languageCode = selectedLanguage1 === "English" ? "en-US" : "fil-PH" // Default to Filipino for other languages
              // await Voice.start(languageCode)
              ToastAndroid.show("Listening...", ToastAndroid.SHORT)
            } else {
              console.log("Voice module is not available")
              Alert.alert("Error", "Voice recognition is not available on this device")
            }
          } catch (e) {
            console.error("Voice start error:", e)
            Alert.alert("Error", "Failed to start voice recognition")
          }
        },
      },
      {
        text: "Whisper (Accurate)",
        onPress: () => startWhisperRecording(),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ])
  }

  const swapLanguages = () => {
    setSelectedLanguage1(selectedLanguage2)
    setSelectedLanguage2(selectedLanguage1)
  }

  const clearText = () => {
    if (text || translatedText) {
      setText("")
      setTranslatedText("")
      ToastAndroid.show("Text cleared!", ToastAndroid.SHORT)
    } else {
      ToastAndroid.show("No text to clear.", ToastAndroid.SHORT)
    }
  }

  const copyToClipboard = async () => {
    console.log("Translated Text: ", translatedText)

    if (translatedText) {
      await Clipboard.setStringAsync(translatedText)
      ToastAndroid.show("Text copied!", ToastAndroid.SHORT)
    } else {
      ToastAndroid.show("No text to copy!", ToastAndroid.SHORT)
    }
  }

  const saveToHistory = async (source, target, inputText, outputText) => {
    try {
      const existingHistory = await AsyncStorage.getItem("translationHistory")
      const parsedHistory = existingHistory ? JSON.parse(existingHistory) : []

      const newEntry = {
        sourceLang: source,
        targetLang: target,
        input: inputText,
        output: outputText,
        timestamp: new Date().toISOString(),
      }

      parsedHistory.unshift(newEntry)
      await AsyncStorage.setItem("translationHistory", JSON.stringify(parsedHistory))
    } catch (error) {
      console.error("Failed to save history:", error)
    }
  }

  // Determine button styles based on the presence of text
  const copyIconStyle = translatedText ? { tintColor: theme.textColor } : { tintColor: "gray" }
  const trashIconStyle = text ? { tintColor: theme.textColor } : { tintColor: "gray" }

  // Automatically translate after a debounce delay when text or language changes
  useEffect(() => {
    if (!text.trim()) {
      setTranslatedText("")
      return
    }

    const debounceTimeout = setTimeout(() => {
      translateTextWithOpenAI(text, selectedLanguage1, selectedLanguage2, (result) => {
        setTranslatedText(result)
        saveToHistory(selectedLanguage1, selectedLanguage2, text, result) // Save to history
      })
    }, 500)

    return () => clearTimeout(debounceTimeout)
  }, [text, selectedLanguage1, selectedLanguage2])

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Image source={require("./assets/menu.png")} style={[styles.icon, { tintColor: theme.textColor }]} />
        </TouchableOpacity>
        <Text style={[styles.headerText, { color: theme.textColor }]}>DINIG</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
          <Image source={require("./assets/settings.png")} style={[styles.icon, { tintColor: theme.textColor }]} />
        </TouchableOpacity>
      </View>

      {/* Combined Translation Container */}
      <View style={[styles.translationContainer, { backgroundColor: theme.cardColor }]}>
        <View style={[styles.languageContainer, { backgroundColor: theme.cardColor }]}>
          <View style={[styles.pickerWrapper, { backgroundColor: theme.cardColor }]}>
            <Picker
              selectedValue={selectedLanguage1}
              style={[styles.picker, { color: theme.textColor }]}
              onValueChange={setSelectedLanguage1}
            >
              <Picker.Item label="English" value="English" />
              <Picker.Item label="Bicol" value="Bicol" />
              <Picker.Item label="Cebuano" value="Cebuano" />
              <Picker.Item label="Chavacano" value="Chavacano" />
              <Picker.Item label="Hiligaynon" value="Hiligaynon" />
              <Picker.Item label="Ilocano" value="Ilocano" />
              <Picker.Item label="Maranao" value="Maranao" />
              <Picker.Item label="Tagalog" value="Tagalog" />
              <Picker.Item label="Waray" value="Waray" />
            </Picker>
          </View>

          <TouchableOpacity onPress={swapLanguages} style={[styles.swapButton, { backgroundColor: theme.cardColor }]}>
            <Image source={require("./assets/swap.png")} style={[styles.swapIcon, { tintColor: theme.textColor }]} />
          </TouchableOpacity>
          <View style={[styles.pickerWrapper, { backgroundColor: theme.cardColor }]}>
            <Picker
              selectedValue={selectedLanguage2}
              style={[styles.picker, { color: theme.textColor }]}
              onValueChange={setSelectedLanguage2}
            >
              <Picker.Item label="English" value="English" />
              <Picker.Item label="Bicol" value="Bicol" />
              <Picker.Item label="Cebuano" value="Cebuano" />
              <Picker.Item label="Chavacano" value="Chavacano" />
              <Picker.Item label="Hiligaynon" value="Hiligaynon" />
              <Picker.Item label="Ilocano" value="Ilocano" />
              <Picker.Item label="Maranao" value="Maranao" />
              <Picker.Item label="Tagalog" value="Tagalog" />
              <Picker.Item label="Waray" value="Waray" />
            </Picker>
          </View>
        </View>

        {/* Text Input Area */}
        <View style={[styles.textInputContainer, { backgroundColor: theme.cardColor }]}>
          <ScrollView>
            <TextInput
              placeholder="Enter Text Here"
              style={[styles.textInput, { fontSize: fontSize, color: theme.textColor }]}
              value={text}
              onChangeText={setText}
              multiline
              placeholderTextColor={isDarkMode ? "#888" : "#999"}
            />
          </ScrollView>
        </View>

        {/* Text Output Area */}
        <View style={[styles.textOutputContainer, { backgroundColor: theme.cardColor }]}>
          <ScrollView>
            <TextInput
              style={[styles.textOutput, { fontSize: fontSize, color: theme.textColor }]}
              multiline
              value={translatedText}
              editable={false}
              scrollEnabled={true}
            />
          </ScrollView>
        </View>

        {/* Action Buttons Container */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
            <Image source={require("./assets/copy.png")} style={[styles.copyIcon, copyIconStyle]} />
          </TouchableOpacity>

          <TouchableOpacity onPress={clearText} style={styles.trashButton}>
            <Image source={require("./assets/trash.png")} style={[styles.trashIcon, trashIconStyle]} />
          </TouchableOpacity>
        </View>
      </View>
 {/* Transcribing Indicator */}
 {isTranscribing && (
        <View style={styles.transcribingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.transcribingText}>Transcribing with Whisper...</Text>
        </View>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.navBarContainer}>
        <View style={[styles.navBar, { backgroundColor: theme.buttonsColor }]}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("TwoWay")}>
            <Ionicons name="people" size={24}  color="white" />
            <Text style={[styles.buttonText, { color: theme.textColor }]}>One-on-One</Text>
          </TouchableOpacity>

          {/* Empty space for the center button */}
          <View style={styles.centerButtonPlaceholder} />

          <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate("History")}>
            <Ionicons name="time" size={24} color="white"  />
            <Text style={[styles.buttonText, { color: theme.textColor }]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Floating center button */}
        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              backgroundColor: recording ? "#ff4d4d" : theme.primaryColor || "#4a90e2",
              borderColor: theme.backgroundColor,
            },
          ]}
          onPress={startListening}
        >
          <Ionicons name={recording ? "stop-circle" : "mic"} size={32} color="white" />
        </TouchableOpacity>
      </View>

      <StatusBar style={isDarkMode ? "light" : "auto"} />
    </View>
  )
}

// TWO WAY SCREEN
function TwoWayScreen() {
  const navigation = useNavigation();
  const [selectedLanguage1, setSelectedLanguage1] = useState('Tagalog');
  const [selectedLanguage2, setSelectedLanguage2] = useState('English');
  const [isRecording1, setIsRecording1] = useState(false);
  const [isRecording2, setIsRecording2] = useState(false);
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const { theme, isDarkMode } = useContext(ThemeContext);

  useEffect(() => {
    Voice.onSpeechResults = (event) => {
      if (isRecording1) {
        setText1(event.value[0]);
      } else if (isRecording2) {
        setText2(event.value[0]);
      }
    };
  
    Voice.onSpeechEnd = () => {
      setIsRecording1(false);
      setIsRecording2(false);
    };
  
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [isRecording1, isRecording2]);

  const startListening = async (target) => {
    try {
      if (target === 'card1') {
        setIsRecording1(true);
        await Voice.start('en-US');
      } else {
        setIsRecording2(true);
        await Voice.start('en-US');
      }
    } catch (error) {
      console.error('Error starting Voice:', error);
    }
  };
  
  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping Voice:', error);
    }
  };
  
  return (
    <SafeAreaView style={[styles.twoWayContainer, { backgroundColor: theme.backgroundColor }]}>
    
      {/* First Card (rotated 180 degrees) */}
      <View style={[styles.twoWayCard, { transform: [{ rotate: '180deg' }], backgroundColor: theme.cardColor }]}>
        <TouchableOpacity
          style={styles.micBottomRight}
          onPress={() => {
            isRecording2 ? stopListening() : startListening('card2');
          }}
        >
          <MaterialCommunityIcons
            name={isRecording2 ? 'microphone' : 'microphone-off'}
            size={24}
            color="white"
          />
          
        </TouchableOpacity>
        <TouchableOpacity style={styles.trashBottomLeft}>
          <Ionicons name="trash-outline" size={20} color={theme.textColor} />
        </TouchableOpacity>


        <View style={[styles.pickerWrapperBottom, { backgroundColor: theme.cardColor }]}>
          <Picker
            selectedValue={selectedLanguage1}
            style={[styles.picker, {color: theme.textColor}]}
            onValueChange={setSelectedLanguage1}
          >
            <Picker.Item label="English" value="English" />
            <Picker.Item label="Bicol" value="Bicol" />
            <Picker.Item label="Cebuano" value="Cebuano" />
            <Picker.Item label="Chavacano" value="Chavacano" />
            <Picker.Item label="Hiligaynon" value="Hiligaynon" />
            <Picker.Item label="Ilocano" value="Ilocano" />
            <Picker.Item label="Maranao" value="Maranao" />
            <Picker.Item label="Tagalog" value="Tagalog" />
            <Picker.Item label="Waray" value="Waray" />
          </Picker>
        </View>

        <Text style={[styles.textPrompt, {color: theme.textColor}]}>Open mic to talk...</Text>

        <TouchableOpacity
         style={[styles.micBottomRight, { backgroundColor: theme.buttonsColor }]}
          onPress={() => {
            isRecording2 ? stopListening() : startListening('card2');
          }}
        >
          <MaterialCommunityIcons
            name={isRecording2 ? 'microphone' : 'microphone-off'}
            size={24}
            color="white"
          />
        </TouchableOpacity>
        
      </View>

      {/* Second Card */}
      <View style={[styles.twoWayCard, { backgroundColor: theme.cardColor }]}>
      <View style={[styles.pickerWrapperBottom, { backgroundColor: theme.cardColor }]}>
          <Picker
            selectedValue={selectedLanguage2}
            style={[styles.picker, {color: theme.textColor}]}
            onValueChange={setSelectedLanguage2}
          >
            <Picker.Item label="English" value="English" />
            <Picker.Item label="Bicol" value="Bicol" />
            <Picker.Item label="Cebuano" value="Cebuano" />
            <Picker.Item label="Chavacano" value="Chavacano" />
            <Picker.Item label="Hiligaynon" value="Hiligaynon" />
            <Picker.Item label="Ilocano" value="Ilocano" />
            <Picker.Item label="Maranao" value="Maranao" />
            <Picker.Item label="Tagalog" value="Tagalog" />
            <Picker.Item label="Waray" value="Waray" />
          </Picker>
        </View>

        <Text style={[styles.textPrompt, {color: theme.textColor}]}>Open mic to talk...</Text>

        <TouchableOpacity style={styles.trashBottomLeft}>
          <Ionicons name="trash-outline" size={20} color={theme.textColor} />
        </TouchableOpacity>
  
        <TouchableOpacity style={[styles.micBottomRight, { backgroundColor: theme.buttonsColor }]}>
          <MaterialCommunityIcons name="microphone-off" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// About Screen Component
function AboutScreen() {
  const navigation = useNavigation();
  const { theme, isDarkMode } = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.aboutContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>About</Text>
        <View style={styles.iconContainer}>
          <Ionicons name="information-circle-outline" size={24} color={theme.textColor} />
        </View>
      </View>

      <View style={[styles.aboutCard, { backgroundColor: theme.cardColor }]}>
        <ScrollView style={styles.scrollView}>
          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Welcome to Dinig!</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>
            Dinig is an innovative application designed to bridge the linguistic diversity of the Philippines, where over 175 distinct languages are spoken. Our primary function is to facilitate seamless communication among locals and travelers alike, making it easier for everyone to connect and engage in meaningful conversations.
          </Text>
          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Who We Serve:</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}> Dinig caters to travelers both local and foreign as well as language learners eager to explore the rich tapestry of Philippine languages. Whether you're navigating a bustling market or engaging in cultural exchanges, Dinig is your trusted companion.
          </Text>   
          
          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Key Features:</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>• Speech Recognition: Harness the power of your voice to translate and understand various Philippine languages effortlessly.</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>• Language Learning Tool: Enhance your language skills with practical translation exercises and features tailored to assist learners of all levels.</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>• Translation History Checker: Keep track of your translations to revisit important phrases and conversations whenever needed.</Text>
      
          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Our Story:</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>• Founded and developed by a dedicated team: Kyle Caliwan, Angel Rose Padolina, Romedz Medel, and Anjelo Vergara.</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>• Dinig was born out of a shared motivation: to empower locals and foreigners to communicate with ease throughout the Philippines.</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>• We understand the challenges posed by language barriers and strive to provide an intuitive solution.</Text>
              
              
          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Why Choose Dinig?</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>What sets Dinig apart is our unwavering focus on Philippine languages. We believe that by embracing the unique linguistic landscape of our nation, we can foster greater understanding and connection among people.</Text>
          
      
          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Looking Ahead:</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>Our vision for the future includes expanding our language offerings and incorporating advanced features, such as spoken output of translations. We aim to continuously enhance user experience and further support communication across diverse linguistic groups.</Text>
          

          <Text style={[styles.aboutTitle, { color: theme.textColor }]}>Get in Touch:</Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>We value your feedback and suggestions! For inquiries, please contact us at dinig@dinig.com.ph.</Text>
          

          <Text style={[styles.aboutTitle, { color: theme.textColor }]}></Text>
          <Text style={[styles.aboutParagraph, { color: theme.textColor }]}>Thank you for choosing Dinig! Together, let's break down language barriers and celebrate the richness of Philippine culture.</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Help Screen Component
function HelpScreen() {
  const navigation = useNavigation();
  const { theme, isDarkMode } = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.helpContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.helpbackButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.helpheaderTitle, { color: theme.textColor }]}>Help</Text>
        <View style={styles.iconContainer}>
          <FontAwesome name="question-circle-o" size={24} color={theme.textColor} />
        </View>
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.cardColor }]}>
        <ScrollView style={styles.scrollView}>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>Welcome to the Help section. Here's an overview of the main features and how to use them:</Text>
          <Text style={[styles.helpTitle, { color: theme.textColor }]}>Features Guide:</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>•Translation: How to translate text and use the output box.</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• Speech Recognition: Using voice input and supported languages.</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• History: Viewing and managing translation history.</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• Settings: Adjusting text size, dark mode, and notifications.</Text>

          <Text style={[styles.helpTitle, { color: theme.textColor }]}>Frequently Asked Questions:</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• How do I clear my translation history?</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• Can I translate without using voice input?</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• What languages does the app support? </Text>

          <Text style={[styles.helpTitle, { color: theme.textColor }]}>Troubleshooting Tips:</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• Issues with translations not displaying correctly.</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• Troubleshooting speech recognition.</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>• Steps to reset settings.</Text>

          <Text style={[styles.helpTitle, { color: theme.textColor }]}>Contact and Feedback:</Text>
          <Text style={[styles.helpItem, { color: theme.textColor }]}>If you have further questions or suggestions, please contact us.</Text>

          <Text style={[styles.helpSubtitle, { color: theme.textColor }]}>Having issues?</Text>
          <Text style={[styles.helpParagraph, { color: theme.textColor }]}>Contact our support team at support@dinig.com</Text>

          <Text style={[styles.helpSubtitle, { color: theme.textColor }]}></Text>
          <TouchableOpacity style={[styles.contactButton, { backgroundColor: theme.buttonsColor }]} onPress={() => navigation.navigate('Feedback')}>
            <Text style={styles.contactbuttonText}>Contact Support</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Feedback Screen Component
function FeedbackScreen() {
  const navigation = useNavigation();
  const { theme, isDarkMode } = useContext(ThemeContext);

  return (
    <SafeAreaView style={[styles.feedbackContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.feedbackheaderTitle, { color: theme.textColor }]}>Feedback</Text>
        <View style={styles.iconContainer}>
          <MaterialIcons name="feedback" size={24} color={theme.textColor} />
        </View>
      </View>

      <View style={[styles.feedbackCard, { backgroundColor: theme.cardColor }]}>
        <Text style={[styles.feedbackTitle, { color: theme.textColor }]}>We value your feedback!</Text>
        <Text style={[styles.feedbackParagraph, { color: theme.textColor }]}>
          Let us know what you think about DINIG and how we can improve.
        </Text>
        <Text style={[styles.feedbackParagraph, { color: theme.textColor }]}>
          Please send your comments, suggestions, or bug reports to:
        </Text>
        <Text style={[styles.feedbackEmail, { color: '#0077cc' }]}>feedback@dinig.com</Text>
        <Text style={[styles.feedbackParagraph, { color: theme.textColor }]}>
          Your input helps us make DINIG better for everyone.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// Trivia Screen Component
function TriviaScreen() {
  const navigation = useNavigation();
  const [trivia, setTrivia] = useState('');
  const [loading, setLoading] = useState(true);
  const { theme, isDarkMode } = useContext(ThemeContext);

  useEffect(() => {
    const loadTrivia = async () => {
      try {
        const savedTrivia = await AsyncStorage.getItem('trivia');
        const lastFetched = await AsyncStorage.getItem('triviaTimestamp');
        const now = new Date().getTime();

        // If it's been less than 24 hours, use cached trivia
        if (savedTrivia && lastFetched && now - parseInt(lastFetched) < 24 * 60 * 60 * 1000) {
          setTrivia(savedTrivia);
          setLoading(false);
          return;
        }

        // Otherwise, fetch new trivia
        const newTrivia = await fetchTriviaFromOpenAI();
        setTrivia(newTrivia);
        await AsyncStorage.setItem('trivia', newTrivia);
        await AsyncStorage.setItem('triviaTimestamp', now.toString());
        setLoading(false);
      } catch (error) {
        setTrivia('Failed to load trivia.');
        setLoading(false);
        console.error(error);
      }
    };

    loadTrivia();
  }, []);

  const fetchTriviaFromOpenAI = async () => {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful trivia generator.',
          },
          {
            role: 'user',
            content: 'Give me one interesting trivia about the Philippines in 1-3 sentences.',
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const triviaText = data?.choices?.[0]?.message?.content?.trim();
    return triviaText || 'Trivia not available at the moment.';
  };
  
  return (
    <SafeAreaView style={[styles.triviaContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Trivia</Text>
        <View style={styles.iconContainer}>
          <Ionicons name="bulb-outline" size={24} color={theme.textColor} />
        </View>
      </View>
  
      <View style={[styles.triviaCard, { backgroundColor: theme.cardColor }]}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.textColor} />
        ) : (
          <>
            <Text style={[styles.triviaTitle, { color: theme.textColor }]}>DID YOU KNOW?</Text>
            <Text style={[styles.triviaParagraph, { color: theme.textColor }]}>{trivia}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// Settings Screen Component
function SettingsScreen() {
  const navigation = useNavigation();
  const { isDarkMode, toggleTheme, theme, fontSize, setAppFontSize } = useContext(ThemeContext);
  const [dailyTips, setDailyTips] = useState(true);
  const [dataCollection, setDataCollection] = useState(true);
  const [voiceCommands, setVoiceCommands] = useState(true);
  
  // Calculate slider value (0-1) based on font size (14-24)
  const sliderValue = (fontSize - 14) / 10;
  
  const handleSliderChange = (value) => {
    // Convert slider value (0-1) to font size (14-24)
    const newFontSize = 14 + (value * 10);
    setAppFontSize(newFontSize);
  };

  return (
    <SafeAreaView style={[styles.settingsContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Settings</Text>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.cardColor }]}>
        <View style={[styles.settingRow, {color: theme.rowColor}]}>
          <Text style={[styles.settingLabel, { color: theme.textColor }]}>Dark Mode</Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: "#e0e0e0", true: "#81b0ff" }}
            thumbColor={isDarkMode ? "#2196F3" : "#f4f3f4"}
          />
        </View>
          
        <Text style={[styles.settingHeader, { color: theme.textColor }]}>Notification Settings</Text>
        <View style={styles.settingRow}>
          <View style={styles.checkboxRow}>
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Receive Daily Language Tips</Text>
          </View>
          <TouchableOpacity onPress={() => setDailyTips(!dailyTips)}>
            <View style={[styles.checkbox, dailyTips && styles.checkboxChecked]}>
              {dailyTips && <Feather name="check" size={16} color="white" />}
            </View>
          </TouchableOpacity>
        </View>
          
        <Text style={[styles.settingHeader, { color: theme.textColor }]}>Privacy Settings</Text>
        <View style={styles.settingRow}>
          <View style={styles.checkboxRow}>
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Allow Data Collection</Text>
          </View>
          <TouchableOpacity onPress={() => setDataCollection(!dataCollection)}>
            <View style={[styles.checkbox, dataCollection && styles.checkboxChecked]}>
              {dataCollection && <Feather name="check" size={16} color="white" />}
            </View>
          </TouchableOpacity>
        </View>
          
        <Text style={[styles.settingHeader, { color: theme.textColor }]}>Accessibility Options</Text>
        <Text style={[styles.settingLabel, { color: theme.textColor }]}>Text Size</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={sliderValue}
          onValueChange={handleSliderChange}
          minimumTrackTintColor="#009688"
          maximumTrackTintColor="#e0e0e0"
          thumbTintColor="#009688"
        />
    
        <View style={styles.settingRow}>
          <View style={styles.checkboxRow}>
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Enable Voice Commands</Text>
          </View>
          <TouchableOpacity onPress={() => setVoiceCommands(!voiceCommands)}>
            <View style={[styles.checkbox, voiceCommands && styles.checkboxChecked]}>
              {voiceCommands && <Feather name="check" size={16} color="white" />}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// History Screen Component
function HistoryScreen() {
  const navigation = useNavigation();
  const [history, setHistory] = useState([]);
  const { theme, isDarkMode } = useContext(ThemeContext);
  
  useFocusEffect(
    React.useCallback(() => {
      const loadHistory = async () => {
        try {
          const stored = await AsyncStorage.getItem('translationHistory');
          setHistory(stored ? JSON.parse(stored) : []);
        } catch (error) {
          console.error("Failed to load history:", error);
        }
      };
      loadHistory();
    }, [])
  );
  
  const deleteHistoryItem = async (index) => {
    try {
      const updatedHistory = [...history];
      updatedHistory.splice(index, 1);
      setHistory(updatedHistory);
      await AsyncStorage.setItem('translationHistory', JSON.stringify(updatedHistory));
      ToastAndroid.show('History item deleted.', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error deleting history item:', error);
      ToastAndroid.show('Failed to delete item.', ToastAndroid.SHORT);
    }
  };
  
  const clearHistory = async () => {
    await AsyncStorage.removeItem('translationHistory');
    setHistory([]);
    ToastAndroid.show('History cleared.', ToastAndroid.SHORT);
  };
  
  return (
    <SafeAreaView style={[styles.historyContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.historyHeader, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.historyheaderTitle, { color: theme.textColor }]}>History</Text>
        <View style={{ width: 24 }} />
      </View>
  
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {history.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 50, color: theme.textColor }}>No translation history yet.</Text>
        ) : (
          history.map((entry, index) => (
            <Swipeable
              key={index}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    Alert.alert(
                      'Delete Entry',
                      'Are you sure you want to delete this history entry?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          onPress: () => deleteHistoryItem(index),
                          style: 'destructive',
                        },
                      ],
                      { cancelable: true }
                    );
                  }}
                >
                  <Ionicons name="trash" size={24} color="white" />
                </TouchableOpacity>
              )}
            >
              <View style={[styles.historyCard, { backgroundColor: theme.cardColor }]}>
                <Text style={[styles.historyEntryTitle, { color: theme.textColor }]}>
                  {entry.sourceLang} ➜ {entry.targetLang}
                </Text>
                <Text style={[styles.historyEntryInput, { color: theme.textColor }]}>{entry.input}</Text>
                <Text style={[styles.historyEntryOutput, { color: isDarkMode ? '#aaa' : 'gray' }]}>{entry.output}</Text>
              </View>
            </Swipeable>
          ))
        )}
      </ScrollView>
  
      {history.length > 0 && (
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: theme.buttonsColor }]}
          onPress={() => {
            Alert.alert(
              'Clear History',
              'Are you sure you want to delete all translation history?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  onPress: () => {
                    clearHistory();
                    ToastAndroid.show('History cleared.', ToastAndroid.SHORT);
                  },
                  style: 'destructive',
                },
              ],
              { cancelable: true }
            );
          }}
        >
          <Text style={styles.clearButtonText}>CLEAR HISTORY</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// Custom Drawer Content
function CustomDrawerContent({ navigation }) {
  const { theme, isDarkMode } = useContext(ThemeContext);
  
  const confirmExit = () => {
    Alert.alert(
      'Exit App',
      'Are you sure you want to exit?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', onPress: () => BackHandler.exitApp() }
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.drawerContainer, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.drawerHeader, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <TouchableOpacity onPress={() => navigation.closeDrawer()}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.drawerTitle, { color: theme.textColor }]}>Menu</Text>
      </View>
      
      <View style={[styles.drawerContent, { backgroundColor: theme.cardColor }]}>
        <TouchableOpacity 
          style={[styles.drawerItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
          onPress={() => navigation.navigate('About')}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="information-circle-outline" size={24} color={theme.textColor} />
          </View>
          <Text style={[styles.drawerItemText, { color: theme.textColor }]}>About</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.drawerItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
          onPress={() => navigation.navigate('Help')}
        >
          <View style={styles.iconContainer}>
            <FontAwesome name="question-circle-o" size={24} color={theme.textColor} />
          </View>
          <Text style={[styles.drawerItemText, { color: theme.textColor }]}>Help</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.drawerItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
          onPress={() => navigation.navigate('Feedback')}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="feedback" size={24} color={theme.textColor} />
          </View>
          <Text style={[styles.drawerItemText, { color: theme.textColor }]}>Feedback</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.drawerItem, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} 
          onPress={() => navigation.navigate('Trivia')}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="bulb-outline" size={24} color={theme.textColor} />
          </View>
          <Text style={[styles.drawerItemText, { color: theme.textColor }]}>Trivia of the Day</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.drawerItem} 
          onPress={confirmExit}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="exit-to-app" size={24} color={theme.textColor} />
          </View>
          <Text style={[styles.drawerItemText, { color: theme.textColor }]}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ThemeProvider Component
function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(16);
   
  const lightTheme = {
    backgroundColor: '#A2D2FF',
    textColor: 'black',
    cardColor: 'white',
    navBarColor: '#F4A261',
    rowColor: '#000000',
    buttonsColor: '#F4A261',
  };
  
  const darkTheme = {
    backgroundColor: '#141414',
    textColor: 'white',
    cardColor: '#333333',
    navBarColor: '#222222',
    rowColor: '#ffffff',
    buttonsColor: '#2196F3',
  };
  
  const theme = isDarkMode ? darkTheme : lightTheme;
  
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Load font size and theme from storage when app starts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSize = await AsyncStorage.getItem('fontSize');
        if (savedSize !== null) {
          setFontSize(parseFloat(savedSize));
        }
        
        const savedTheme = await AsyncStorage.getItem('isDarkMode');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'true');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, []);
  
  // Save theme preference when it changes
  useEffect(() => {
    const saveThemePreference = async () => {
      try {
        await AsyncStorage.setItem('isDarkMode', isDarkMode.toString());
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    };
    
    saveThemePreference();
  }, [isDarkMode]);
  
  const setAppFontSize = async (size) => {
    setFontSize(size);
    try {
      await AsyncStorage.setItem('fontSize', size.toString());
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };
  
  return (
    <ThemeContext.Provider value={{ 
      isDarkMode, 
      toggleTheme, 
      theme,
      fontSize,
      setAppFontSize
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Main App Component
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { theme } = useContext(ThemeContext);
  
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Drawer.Navigator
          initialRouteName="Translation"
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerStyle: {
              backgroundColor: theme.backgroundColor,
              width: '65%',
            },
          }}
        >
          <Drawer.Screen 
            name="Translation" 
            component={TranslationScreen} 
          />
          <Drawer.Screen 
            name="About" 
            component={AboutScreen} 
          />
          <Drawer.Screen 
            name="Help" 
            component={HelpScreen} 
          />
          <Drawer.Screen 
            name="Feedback" 
            component={FeedbackScreen} 
          />
          <Drawer.Screen 
            name="Trivia" 
            component={TriviaScreen} 
          />
          <Drawer.Screen 
            name="Settings" 
            component={SettingsScreen} 
          />
          <Drawer.Screen 
            name="TwoWay" 
            component={TwoWayScreen} 
          />
          <Drawer.Screen 
            name="History" 
            component={HistoryScreen} 
          />
        </Drawer.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#A2D2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: 30,
    backgroundColor: '#A2D2FF',
    position: 'absolute',
    top: 20,
  },
  headerText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  icon: {
    width: 24,
    height: 24,
  },
  translationContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 20,
    width: '90%',
    alignItems: 'baseline',
    position: 'relative', 
  },
  
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 1,
    width: '100%',
    marginBottom: 5,
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 5,
    marginHorizontal: 1,
  },
  picker: {
    height: 55,
    width: '100%',
  },
  swapButton: {
    padding: 5,
  },
  swapIcon: {
    width: 20,
    height: 20,
  },
  textInputContainer: {
    backgroundColor: 'white',
    width: '100%',
    minHeight: 170,
    maxHeight: 170,
    borderRadius: 15,
    marginTop: 1,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D3D3D3',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: 'black',
  },
  textOutputContainer: {
    backgroundColor: 'white',
    width: '100%',
    minHeight: 170,
    maxHeight: 170,
    borderRadius: 15,
    marginTop: 10,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D3D3D3',
  },
  textOutput: {
    flex: 1,
    fontSize: 15,
    color: 'black',
  },

  //BUTTON ANIMATION AND STYLE
 actionButtonsContainer: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
  marginTop: 10,
},

copyButton: {
  padding: 3,
  borderRadius: 8,
  marginLeft: 250,
},

trashButton: {
  padding: 3,
  borderRadius: 8,
},

copyIcon: {
  width: 24,
  height: 24,
},

trashIcon: {
  width: 24,
  height: 24,
},


//NAVBAR STYLE
navBarContainer: {
  position: "absolute",
  bottom: 0,
  width: "100%",
},
navBar: {
  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
  padding: 15,
  paddingBottom: 20,
  borderTopWidth: 1,
  borderTopColor: "#ddd",
},
navButton: {
  alignItems: "center",
  flex: 1,
},
buttonText: {
  fontSize: 12,
  marginTop: 4,
},
centerButtonPlaceholder: {
  width: 70,
},
floatingButton: {
  position: "absolute",
  bottom: 40, // Increased from 5 to position it higher above the navbar
  alignSelf: "center",
  width: 80,
  height: 80,
  borderRadius: 40,
  justifyContent: "center",
  alignItems: "center",
  elevation: 5,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  borderWidth: 3,
  zIndex: 10, // Added to ensure it appears above other elements
},
transcribingOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
},
transcribingText: {
  color: "white",
  marginTop: 10,
  fontSize: 16,
},

 // TWO WAY STYLE
 twowaybackButton: {
  padding: 1,
},
 twoWayContainer: {
  flex: 1,
  backgroundColor: '#A2D2FF',
  padding: 16,
  justifyContent: 'space-evenly',
},

twowayHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

twoWayCard: {
  backgroundColor: '#fff',
  borderRadius: 20,
  padding: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
  position: 'relative',
  minHeight: 250,
  justifyContent: 'center',
},

textPrompt: {
  fontSize: 16,
  color: '#888',
  textAlign: 'center',
  marginVertical: 10,
},

micBottomRight: {
  position: 'absolute',
  bottom: 10,
  right: 10,
  backgroundColor: '#F4A261', 
  padding: 10,
  borderRadius: 50,
},

trashBottomLeft: {
  position: 'absolute',
  bottom: 20,
  left: 20,
},

pickerWrapperBottom: {
  position: 'absolute',
  top: 10,
  left: 10,
  width: 150,
  height: 50,
  backgroundColor: '#ffff',
  borderRadius: 8,
  justifyContent: 'center',
  overflow: 'hidden',
},

  // Drawer styles
  drawerContainer: {
    flex: 1,
    backgroundColor: '#A2D2FF',
    paddingTop: 30,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 20,
  },
  drawerContent: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 10,
    padding: 20,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  iconContainer: {
    width: 40,
    height: 30,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: '500',
  },

  // ABOUT STYLE
  aboutContainer: {
    flex: 1,
    backgroundColor: '#A2D2FF',
    padding: 5,
    paddingTop: 60,
  },

aboutCard: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  marginHorizontal: 20,
  marginTop: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
  marginBottom: 20,
  flex: 1,  
},

aboutTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 5,
  marginTop: 5, 
},

aboutParagraph: {
  fontSize: 16,
  fontWeight: '400',
  marginBottom: 10,
  lineHeight: 22,
},

// HELPSCREEN STYLE
helpContainer: {
  flex: 1,
  backgroundColor: '#A2D2FF', 
  padding: 10,
  paddingTop: 60,
},

contactButton: {
  backgroundColor: '#F4A261',
  width: 160,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
  paddingVertical: 10, 
  marginVertical: 10,
  elevation: 3,
},
contactbuttonText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: '600',
},

helpHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 15,
  marginBottom: 10,
},

helpheaderTitle: {
  fontSize: 30,
  fontWeight: 'bold',
  textAlign: 'center',
  flex: 1,
},

helpCard: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  marginHorizontal: 20,
  marginTop: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
  marginBottom: 20,
  flex: 1,  
},

helpTitle: {
  fontSize: 17,
  fontWeight: 'bold',
  marginTop: 8,
  marginBottom: 2,
},

helpSubtitle: {
  fontSize: 18,
  fontWeight: '600',
  marginTop: 10,
  marginBottom: 3,
},

helpItem: {
  fontSize: 16,
  marginBottom: 6,
},

helpParagraph: {
  fontSize: 16,
  fontWeight: '400',
  marginTop: 5,
  lineHeight: 22,
},

 //FEEDBACK STYLE
 feedbackContainer: {
  flex: 1,
  backgroundColor: '#A2D2FF',
  padding: 5,
  paddingTop: 60,
},

feedbackheaderTitle: {
  fontSize: 30,
  fontWeight: 'bold',
  textAlign: 'center',
  flex: 1,
},

feedbackCard: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  marginHorizontal: 20,
  marginTop: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
},

feedbackTitle: {
  fontSize: 22,
  fontWeight: 'bold',
  marginBottom: 15,
},

feedbackParagraph: {
  fontSize: 16,
  marginBottom: 10,
  lineHeight: 22,
},

feedbackEmail: {
  fontSize: 16,
  fontWeight: '600',
  color: '#0077cc',
  marginBottom: 10,
},

 //TRIVIA OF THE DAY STYLE 
 triviaContainer: {
  flex: 1,
  backgroundColor: '#A2D2FF',
  padding: 5,
  paddingTop: 60,
},

triviaheaderTitle: {
  fontSize: 30,
  fontWeight: 'bold',
  textAlign: 'center',
  flex: 1,
},

triviaCard: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  marginHorizontal: 20,
  marginTop: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
},

triviaTitle: {
  fontSize: 22,
  fontWeight: 'bold',
  marginBottom: 15,
},

triviaParagraph: {
  fontSize: 16,
  marginBottom: 10,
  lineHeight: 22,
},

 // HISTORY STYLE
 historyContainer: {
  flex: 1,
  backgroundColor: '#A2D2FF',
  padding: 5,
  paddingTop: 30,
},
historyHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  marginBottom: 10,
},
historyheaderTitle: {
  flex: 1,
  fontSize: 24,
  fontWeight: 'bold',
  textAlign: 'center',
  color: '#000',
},
historyCard: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  marginHorizontal: 20,
  marginTop: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
},
historyEntryTitle: {
  fontWeight: 'bold',
  fontSize: 16,
  marginBottom: 5,
},
historyEntryInput: {
  fontSize: 14,
  marginBottom: 5,
},
historyEntryOutput: {
  fontSize: 14,
  fontStyle: 'italic',
  color: 'gray',
},
deleteButton: {
  backgroundColor: '#D64545', 
  justifyContent: 'center',
  alignItems: 'center',
  width: 80,
  borderTopRightRadius: 20,
  borderBottomRightRadius: 20,
  marginTop: 10,
  marginBottom: 5,
},

clearButton: {
  backgroundColor: '#F4A261',
  padding: 12,
  borderRadius: 30,
  alignItems: 'center',
  margin: 20,
  elevation: 2,
},
clearButtonText: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
},

// SETTINGS STYLE
settingsContainer: {
  flex: 1,
  backgroundColor: '#A2D2FF',
  padding: 5,
  paddingTop: 60,
},

backButton: {
  padding: 1,
},

headerTitle: {
  fontSize: 30,
  fontWeight: 'bold',
  textAlign: 'center',
  flex: 1,
},
settingsCard: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 15,
  marginHorizontal: 20,        // adds side spacing
  marginTop: 20,               // spacing from top
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,                // shadow for Android
},

settingRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 5,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(0,0,0,0.05)',
},
settingLabel: {
  fontSize: 16,
  fontWeight: '500',
},
settingHeader: {
  fontSize: 18,
  fontWeight: 'bold',
  marginTop: 20,
  marginBottom: 10,
},
checkboxRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
checkbox: {
  width: 24,
  height: 24,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: '#009688',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 10,
},
checkboxChecked: {
  backgroundColor: '#009688',
},
slider: {
  width: '100%',
  height: 40,
},

// Screen container styles
screenContainer: {
  flex: 1,
  backgroundColor: '#ADD8E6',
  padding: 20,
  paddingTop: 60,
},
title: {
  fontSize: 24,
  fontWeight: 'bold',
  marginBottom: 20,
  textAlign: 'center',
},
subtitle: {
  fontSize: 18,
  fontWeight: 'bold',
  marginTop: 15,
  marginBottom: 10,
},
paragraph: {
  fontSize: 16,
  marginBottom: 15,
  lineHeight: 22,
},
helpItem: {
  fontSize: 16,
  marginBottom: 10,
  paddingLeft: 10,
},
scrollView: {
  flex: 1,
},
helpbackButton: {
  padding: 1,
},
});