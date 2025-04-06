import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, Alert, ToastAndroid } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import axios from "axios";
import * as Clipboard from 'expo-clipboard';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons, FontAwesome, MaterialIcons,MaterialCommunityIcons , Feather } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Switch } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import Voice from '@react-native-voice/voice';
import { useEffect } from 'react';

// Create drawer navigator
const Drawer = createDrawerNavigator();
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const translateTextWithOpenAI = async (inputText, sourceLang, targetLang, setTranslatedText) => {
  if (!inputText.trim()) {
    Alert.alert("Error", "Please enter text to translate.");
    return;
  }

   try {
    // Debug: check if key is loaded properly
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
function TranslationScreen({ navigation }) {
  const [selectedLanguage1, setSelectedLanguage1] = useState('English');
  const [selectedLanguage2, setSelectedLanguage2] = useState('Tagalog');
  const [text, setText] = useState('');
  const [translatedText, setTranslatedText] = useState('');



  useEffect(() => {
    Voice.onSpeechResults = onSpeechResultsHandler;
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechResultsHandler = (e) => {
    const spokenText = e.value[0];
    setText(spokenText);
  };

  const startListening = async () => {
    try {
      await Voice.start('en-US'); // You can change language based on selectedLanguage1
    } catch (e) {
      console.error('Voice start error:', e);
    }
  };


  const swapLanguages = () => {
    setSelectedLanguage1(selectedLanguage2);
    setSelectedLanguage2(selectedLanguage1);
  };
  

  const clearText = () => {
    setText('');
    setTranslatedText('');
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(translatedText);
    ToastAndroid.show("Text copied!", ToastAndroid.SHORT);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Image source={require('./assets/menu.png')} style={styles.icon} />
        </TouchableOpacity>
        <Text style={styles.headerText}>DINIG</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Image source={require('./assets/settings.png')} style={styles.icon} />
        </TouchableOpacity>
      </View>

      {/* Combined Translation Container */}
      <View style={styles.translationContainer}>
        <View style={styles.languageContainer}>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedLanguage1} style={styles.picker} onValueChange={setSelectedLanguage1}>
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

          <TouchableOpacity onPress={swapLanguages} style={styles.swapButton}>
            <Image source={require('./assets/swap.png')} style={styles.swapIcon} />
          </TouchableOpacity>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedLanguage2} style={styles.picker} onValueChange={setSelectedLanguage2}>
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
        <View style={styles.textInputContainer}>
          <TextInput placeholder="Enter Text Here" style={styles.textInput} value={text} onChangeText={setText} multiline />
        </View>

        {/* Text Output Area */}
        <View style={styles.textOutputContainer}>
          <TextInput style={styles.textOutput} multiline value={translatedText} editable={false} />
         
        </View>

     {/* Action Buttons Container */}
<View style={styles.actionButtonsContainer}>
  {/* Copy Button */}
  <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
    <Image source={require('./assets/copy.png')} style={styles.copyIcon} />
  </TouchableOpacity>

  {/* Trash Button */}
  <TouchableOpacity onPress={clearText} style={styles.trashButton}>
    <Image source={require('./assets/trash.png')} style={styles.trashIcon} />
  </TouchableOpacity>
</View>
      </View>



      {/* Bottom Navigation Bar */}
            <View style={styles.navBar}>
            <TouchableOpacity style={styles.navButton} onPress={startListening}>
        <Image source={require('./assets/mic.png')} style={styles.buttonIcon} />
        <Text style={styles.buttonText}>Speak</Text>
      </TouchableOpacity>
        <TouchableOpacity onPress={() => translateTextWithOpenAI(text, selectedLanguage1, selectedLanguage2, setTranslatedText)} style={styles.translateButton}>
          <Image source={require('./assets/translate.png')} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Translate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('TwoWayScreen')}>
         <Image source={require('./assets/people.png')} style={styles.buttonIcon} /> 
          <Text style={styles.buttonText}>Two-Way</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton}>
          <Image source={require('./assets/history.png')} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>History</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}


function TwoWayScreen() {
  const navigation = useNavigation();
  return (
    
    <View style={twoWayStyles.twoWayContainer}>
      {/* First Card */}
      <View style={twoWayStyles.twoWayCard}>
        <TouchableOpacity style={twoWayStyles.twoWayMicButtonTopLeft}>
          <MaterialCommunityIcons name="microphone-off" size={24} color="white" />
        </TouchableOpacity>
        <Text style={twoWayStyles.twoWayLanguageLabel}>Tagalog</Text>
        <Text style={twoWayStyles.twoWayTextPrompt}>Open mic to talk...</Text>
        <TouchableOpacity style={twoWayStyles.twoWayTrashIconTopRight}>
          <Ionicons name="trash-outline" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Second Card */}
      <View style={twoWayStyles.twoWayCard}>
        <Text style={twoWayStyles.twoWayLanguageLabel}>English</Text>
        <Text style={twoWayStyles.twoWayTextPrompt}>Open mic to talk...</Text>
        <TouchableOpacity style={twoWayStyles.twoWayTrashIconBottomLeft}>
          <Ionicons name="trash-outline" size={20} color="#888" />
        </TouchableOpacity>
        <TouchableOpacity style={twoWayStyles.twoWayMicButtonBottomRight}>
          <MaterialCommunityIcons name="microphone-off" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}


// About Screen Component
function AboutScreen() {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.title}>About DINIG</Text>
      <Text style={styles.paragraph}>
        DINIG is a translation app designed to help users communicate across different Filipino languages and English.
      </Text>
      <Text style={styles.paragraph}>
        Our mission is to preserve and promote the rich linguistic diversity of the Philippines by making it easier for people to understand and learn different Filipino languages.
      </Text>
      <Text style={styles.paragraph}>
        Version 1.0.0
      </Text>
    </View>
  );
}

// Help Screen Component
function HelpScreen() {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.title}>Help</Text>
      <Text style={styles.subtitle}>How to use DINIG:</Text>
      
      <Text style={styles.helpItem}>1. Select your source and target languages from the dropdown menus.</Text>
      <Text style={styles.helpItem}>2. Enter the text you want to translate in the input box.</Text>
      <Text style={styles.helpItem}>3. Press the "Translate" button to get your translation.</Text>
      <Text style={styles.helpItem}>4. Use the copy button to copy the translated text.</Text>
      <Text style={styles.helpItem}>5. Use the microphone button for voice input.</Text>
      <Text style={styles.helpItem}>6. Use Two-Way mode for conversation between two languages.</Text>
      
      <Text style={styles.subtitle}>Having issues?</Text>
      <Text style={styles.paragraph}>
        Contact our support team at support@dinig.com
      </Text>
    </View>
  );
}

// Feedback Screen Component
function FeedbackScreen() {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.title}>Feedback</Text>
      <Text style={styles.paragraph}>
        We value your feedback! Let us know what you think about DINIG and how we can improve.
      </Text>
      <Text style={styles.paragraph}>
        Please send your comments, suggestions, or bug reports to feedback@dinig.com
      </Text>
      <Text style={styles.paragraph}>
        Your input helps us make DINIG better for everyone.
      </Text>
    </View>
  );
}

// Trivia Screen Component
function TriviaScreen() {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.title}>Trivia of the Day</Text>
      <Text style={styles.paragraph}>
        Did you know? The Philippines has over 170 languages, with 8 major languages having more than one million native speakers each.
      </Text>
      <Text style={styles.paragraph}>
        Tagalog, the basis of the national language Filipino, is only the first language of about 24 million Filipinos, or roughly 22% of the population.
      </Text>
      <Text style={styles.paragraph}>
        Cebuano, spoken primarily in the Visayas and Mindanao, actually has more native speakers than Tagalog!
      </Text>
    </View>
  );
}

  // Settings Screen Component
  function SettingsScreen() {
    const navigation = useNavigation();
    const [darkMode, setDarkMode] = useState(false);
    const [dailyTips, setDailyTips] = useState(true);
    const [dataCollection, setDataCollection] = useState(true);
    const [textSize, setTextSize] = useState(0.5);
    const [voiceCommands, setVoiceCommands] = useState(true);

    return (

      <SafeAreaView style={styles.settingsContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>



        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#e0e0e0", true: "#81b0ff" }}
              thumbColor={darkMode ? "#2196F3" : "#f4f3f4"}
            />
          </View>
          
          <Text style={styles.settingHeader}>Notification Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.checkboxRow}>
           
              <Text style={styles.settingLabel}>Receive Daily Language Tips</Text>
            </View>
            <TouchableOpacity onPress={() => setDailyTips(!dailyTips)}>
              <View style={[styles.checkbox, dailyTips && styles.checkboxChecked]}>
                {dailyTips && <Feather name="check" size={16} color="white" />}
              </View>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.settingHeader}>Privacy Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.checkboxRow}>
           
              <Text style={styles.settingLabel}>Allow Data Collection</Text>
            </View>
            <TouchableOpacity onPress={() => setDataCollection(!dataCollection)}>
              <View style={[styles.checkbox, dataCollection && styles.checkboxChecked]}>
                {dataCollection && <Feather name="check" size={16} color="white" />}
              </View>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.settingHeader}>Accessibility Options</Text>
          <Text style={styles.settingLabel}>Text Size</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={textSize}
            onValueChange={setTextSize}
            minimumTrackTintColor="#009688"
            maximumTrackTintColor="#e0e0e0"
            thumbTintColor="#009688"
          />
          
          <View style={styles.settingRow}>
            <View style={styles.checkboxRow}>
        
              <Text style={styles.settingLabel}>Enable Voice Commands</Text>
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

// Custom Drawer Content
function CustomDrawerContent({ navigation }) {
  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <TouchableOpacity onPress={() => navigation.closeDrawer()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.drawerTitle}>Menu</Text>
      </View>
      
      <View style={styles.drawerContent}>
        <TouchableOpacity 
          style={styles.drawerItem} 
          onPress={() => navigation.navigate('About')}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="information-circle-outline" size={24} color="black" />
          </View>
          <Text style={styles.drawerItemText}>About</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.drawerItem} 
          onPress={() => navigation.navigate('Help')}
        >
          <View style={styles.iconContainer}>
            <FontAwesome name="question-circle-o" size={24} color="black" />
          </View>
          <Text style={styles.drawerItemText}>Help</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.drawerItem} 
          onPress={() => navigation.navigate('Feedback')}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="feedback" size={24} color="black" />
          </View>
          <Text style={styles.drawerItemText}>Feedback</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.drawerItem} 
          onPress={() => navigation.navigate('Trivia')}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="bulb-outline" size={24} color="black" />
          </View>
          <Text style={styles.drawerItemText}>Trivia of the Day</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.drawerItem} 
          onPress={() => console.log('Exit app')}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="exit-to-app" size={24} color="black" />
          </View>
          <Text style={styles.drawerItemText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Drawer.Navigator
          initialRouteName="Translation"
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerStyle: {
              backgroundColor: '#ADD8E6',
              width: '70%',
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
        </Drawer.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ADD8E6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: 30,
    backgroundColor: '#ADD8E6',
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
    borderRadius: 15,
    width: '90%',
    alignItems: 'baseline',
    position: 'relative', // Add this to position the trash button
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    width: '100%',
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 5,
    marginHorizontal: 1,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  swapButton: {
    padding: 5,
  },
  swapIcon: {
    width: 25,
    height: 25,
  },
  textInputContainer: {
    backgroundColor: 'white',
    width: '100%',
    minHeight: 150,
    maxHeight: 150,
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
    minHeight: 150,
    maxHeight: 150,
    borderRadius: 15,
    marginTop: 10,
    padding: 5,
    position: 'relative', // Add this to position the copy button
    borderWidth: 1,
    borderColor: '#D3D3D3',
  },
  textOutput: {
    flex: 1,
    fontSize: 15,
    color: 'black',
    paddingRight: 40, // Add padding to prevent text from going under the copy button
  },
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
  
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#D69A7A',
    position: 'absolute',
    bottom: 0,
    padding: 1,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  buttonIcon: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  translateButton: {
    backgroundColor: '#D69A7A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },


  twoWayContainer: {
    flex: 1,
    backgroundColor: '#add8f6',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  twoWayCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    height: 200,
    justifyContent: 'center',
    position: 'relative',
  },
  twoWayMicButtonTopLeft: {
    backgroundColor: '#f4a261',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -25,
    left: -25,
  },
  twoWayMicButtonBottomRight: {
    backgroundColor: '#f4a261',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -25,
    right: -25,
  },
  twoWayTrashIconTopRight: {
    position: 'absolute',
    top: -25,
    right: -25,
  },
  twoWayTrashIconBottomLeft: {
    position: 'absolute',
    bottom: -25,
    left: -25,
  },
  twoWayLanguageLabel: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  twoWayTextPrompt: {
    color: '#888',
    fontSize: 16,
    alignSelf: 'center',
  },

  // Drawer styles
  drawerContainer: {
    flex: 1,
    backgroundColor: '#ADD8E6',
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
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: '500',
  },
  // Settings styles
  settingsContainer: {
    flex: 1,
    backgroundColor: '#ADD8E6',
    padding: 5,
    paddingTop: 60,
  },
  
backButton: {
  marginRight: 5,
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
    paddingVertical: 15,
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
});