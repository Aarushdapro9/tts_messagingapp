import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = 'https://tts-messagingapp-brown.vercel.app';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
const SESSION_KEY = 'tts-messaging-session';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) throw new Error(data?.message || data?.error || 'Request failed');
  return data;
}

function errorMessage(error) {
  if (error instanceof Error && error.message === 'Network request failed') {
    return 'Cannot reach the chat server. Check your internet connection and API URL.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function chatTitle(chat, user) {
  if (chat.isGlobal) return 'Global Chat';
  if (chat.isGroup) return chat.chatName;
  return chat.users?.find((member) => member._id !== user._id)?.name || 'Direct chat';
}

function chatPreview(chat) {
  if (!chat.latestMessage) return 'No messages yet';
  return chat.latestMessage.message || 'No messages yet';
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

const ChatRow = ({ chat, user, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{initial(chatTitle(chat, user))}</Text></View>
    <View style={styles.rowBody}>
      <Text numberOfLines={1} style={styles.rowTitle}>{chatTitle(chat, user)}</Text>
      <Text numberOfLines={1} style={styles.rowSubtitle}>{chatPreview(chat)}</Text>
    </View>
  </Pressable>
);

const UserRow = ({ person, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{initial(person.name)}</Text></View>
    <View style={styles.rowBody}>
      <Text numberOfLines={1} style={styles.rowTitle}>{person.name}</Text>
      <Text numberOfLines={1} style={styles.rowSubtitle}>{person.email}</Text>
    </View>
    <Text style={styles.messageAction}>Message</Text>
  </Pressable>
);

const MessageRow = ({ item, mine }) => (
  <View style={[styles.messageRow, mine ? styles.messageMineRow : styles.messageOtherRow]}>
    {!mine ? <Text style={styles.senderName}>{item.sender?.name || 'Member'}</Text> : null}
    <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble]}>
      <Text style={mine ? styles.mineMessageText : styles.otherMessageText}>{item.message}</Text>
    </View>
  </View>
);

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Missing details', 'Enter your email and password.');
    if (mode === 'register' && (!firstname.trim() || !lastname.trim())) {
      return Alert.alert('Missing details', 'Enter your first and last name.');
    }
    setSubmitting(true);
    try {
      const session = await request(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: mode === 'login'
          ? { email: email.trim(), password }
          : { firstname: firstname.trim(), lastname: lastname.trim(), email: email.trim(), password },
      });
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      onAuthenticated(session);
    } catch (error) {
      Alert.alert(mode === 'login' ? 'Unable to log in' : 'Unable to register', errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.authWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View>
        <Text style={styles.brand}>TTS Messaging</Text>
        <Text style={styles.authSubtitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
        {mode === 'register' ? (
          <View style={styles.nameRow}>
            <TextInput value={firstname} onChangeText={setFirstname} placeholder="First name" placeholderTextColor="#758096" style={[styles.input, styles.nameInput]} autoCapitalize="words" />
            <TextInput value={lastname} onChangeText={setLastname} placeholder="Last name" placeholderTextColor="#758096" style={[styles.input, styles.nameInput]} autoCapitalize="words" />
          </View>
        ) : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#758096" style={styles.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#758096" style={styles.input} secureTextEntry autoComplete={mode === 'login' ? 'password' : 'new-password'} />
        <Pressable disabled={submitting} onPress={submit} style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.pressed]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>}
        </Pressable>
        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={styles.switchButton}>
          <Text style={styles.switchText}>{mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}</Text>
        </Pressable>
        <Text style={styles.note}>Google sign-in will be added after an iOS OAuth client is configured.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessagesScreen({ chat, messages, user, loading, onBack, onRefresh, onSend }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await onSend(message);
      setDraft('');
    } catch (error) {
      Alert.alert('Unable to send', errorMessage(error));
    } finally {
      setSending(false);
    }
  };
  const renderMessage = useCallback(({ item }) => <MessageRow item={item} mine={item.sender?._id === user._id} />, [user._id]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ Chats</Text></Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>{chatTitle(chat, user)}</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}><Text style={styles.refreshText}>Refresh</Text></Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color="#38c99b" /></View> : (
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={messages.length ? styles.messageList : styles.emptyList}
          ListEmptyComponent={<Text style={styles.emptyText}>Say hello to start this conversation.</Text>}
        />
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Write a message" placeholderTextColor="#758096" style={styles.composerInput} multiline />
          <Pressable onPress={submit} disabled={sending || !draft.trim()} style={({ pressed }) => [styles.sendButton, (pressed || sending || !draft.trim()) && styles.pressed]}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [view, setView] = useState('chats');
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = session?.token;
  const user = session?.user;

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const saved = await SecureStore.getItemAsync(SESSION_KEY);
        if (saved) setSession(JSON.parse(saved));
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      } finally {
        setCheckingSession(false);
      }
    };
    restoreSession();
  }, []);

  const loadChats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setChats(await request('/api/chat', { token }));
    } catch (error) {
      Alert.alert('Unable to load chats', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setUsers(await request('/api/user?search=', { token }));
    } catch (error) {
      Alert.alert('Unable to load users', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMessages = useCallback(async (chat) => {
    if (!token) return;
    setLoading(true);
    try {
      setMessages(await request(`/api/message/${chat._id}`, { token }));
    } catch (error) {
      Alert.alert('Unable to load messages', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (session && view === 'chats') loadChats();
  }, [loadChats, session, view]);

  const openChat = useCallback(async (chat) => {
    setSelectedChat(chat);
    setView('messages');
    await loadMessages(chat);
  }, [loadMessages]);

  const startDirectChat = useCallback(async (person) => {
    setLoading(true);
    try {
      const chat = await request('/api/chat', { token, method: 'POST', body: { userId: person._id } });
      setChats((current) => [chat, ...current.filter((item) => item._id !== chat._id)]);
      setSelectedChat(chat);
      setView('messages');
      await loadMessages(chat);
    } catch (error) {
      Alert.alert('Unable to start chat', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadMessages, token]);

  const sendMessage = useCallback(async (message) => {
    const sent = await request('/api/message', { token, method: 'POST', body: { chatId: selectedChat._id, message } });
    setMessages((current) => [...current, sent]);
  }, [selectedChat?._id, token]);

  const logOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setChats([]);
    setUsers([]);
    setMessages([]);
    setView('chats');
  }, []);

  const renderChat = useCallback(({ item }) => <ChatRow chat={item} user={user} onPress={() => openChat(item)} />, [openChat, user]);
  const renderUser = useCallback(({ item }) => <UserRow person={item} onPress={() => startDirectChat(item)} />, [startDirectChat]);
  const title = view === 'users' ? 'All users' : 'Chats';
  const list = view === 'users' ? users : chats;
  const renderItem = view === 'users' ? renderUser : renderChat;
  const reload = view === 'users' ? loadUsers : loadChats;
  const emptyLabel = view === 'users' ? 'No other users yet.' : 'No chats yet.';

  if (checkingSession) return <View style={styles.splash}><ActivityIndicator color="#38c99b" /></View>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  if (view === 'messages' && selectedChat) {
    return <MessagesScreen chat={selectedChat} messages={messages} user={user} loading={loading} onBack={() => { setView('chats'); setSelectedChat(null); }} onRefresh={() => loadMessages(selectedChat)} onSend={sendMessage} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.homeHeader}>
        <View><Text style={styles.homeGreeting}>Hi, {user.name.split(' ')[0]}</Text><Text style={styles.homeTitle}>{title}</Text></View>
        <Pressable onPress={logOut} style={styles.logoutButton}><Text style={styles.logoutText}>Log out</Text></Pressable>
      </View>
      <View style={styles.tabRow}>
        <Pressable onPress={() => setView('chats')} style={[styles.tab, view === 'chats' && styles.activeTab]}><Text style={[styles.tabText, view === 'chats' && styles.activeTabText]}>Chats</Text></Pressable>
        <Pressable onPress={() => { setView('users'); loadUsers(); }} style={[styles.tab, view === 'users' && styles.activeTab]}><Text style={[styles.tabText, view === 'users' && styles.activeTabText]}>People</Text></Pressable>
      </View>
      {loading && !list.length ? <View style={styles.center}><ActivityIndicator color="#38c99b" /></View> : (
        <FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#38c99b" />}
          contentContainerStyle={list.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.emptyText}>{emptyLabel}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

export default App;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101419' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101419' },
  authWrap: { flex: 1, justifyContent: 'center', padding: 28 },
  brandMark: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#38c99b', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  brandMarkText: { color: '#101419', fontSize: 30, fontWeight: '800' },
  brand: { color: '#f7f9fc', fontSize: 31, fontWeight: '800' },
  authSubtitle: { color: '#a4adbd', fontSize: 16, marginTop: 8, marginBottom: 28 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameInput: { flex: 1 },
  input: { backgroundColor: '#1c232c', borderRadius: 12, color: '#f7f9fc', fontSize: 16, paddingHorizontal: 16, height: 54, marginBottom: 12 },
  primaryButton: { height: 54, borderRadius: 12, backgroundColor: '#38c99b', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: '#0b1512', fontSize: 17, fontWeight: '800' },
  switchButton: { alignSelf: 'center', padding: 16 },
  switchText: { color: '#72ddba', fontSize: 14, fontWeight: '700' },
  note: { color: '#758096', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  pressed: { opacity: 0.68 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  homeGreeting: { color: '#a4adbd', fontSize: 14 },
  homeTitle: { color: '#f7f9fc', fontSize: 28, fontWeight: '800', marginTop: 3 },
  logoutButton: { borderWidth: 1, borderColor: '#3a4655', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  logoutText: { color: '#dce3ed', fontWeight: '700' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#202834' },
  tab: { marginRight: 24, paddingBottom: 12 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#38c99b' },
  tabText: { color: '#8f9aac', fontWeight: '700' },
  activeTabText: { color: '#f7f9fc' },
  list: { paddingVertical: 8 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#283542' },
  avatarText: { color: '#72ddba', fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, marginLeft: 13 },
  rowTitle: { color: '#f7f9fc', fontSize: 16, fontWeight: '700' },
  rowSubtitle: { color: '#8f9aac', fontSize: 14, marginTop: 4 },
  messageAction: { color: '#72ddba', fontSize: 13, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#8f9aac', textAlign: 'center', fontSize: 15 },
  topBar: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#202834' },
  backButton: { width: 74 },
  backText: { color: '#72ddba', fontWeight: '700', fontSize: 14 },
  topTitle: { flex: 1, color: '#f7f9fc', fontWeight: '800', fontSize: 17, textAlign: 'center' },
  refreshButton: { width: 74, alignItems: 'flex-end' },
  refreshText: { color: '#72ddba', fontWeight: '700', fontSize: 13 },
  messageList: { paddingHorizontal: 16, paddingVertical: 14 },
  messageRow: { marginBottom: 12, maxWidth: '82%' },
  messageMineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageOtherRow: { alignSelf: 'flex-start' },
  senderName: { color: '#8f9aac', fontSize: 12, marginBottom: 4, marginLeft: 3 },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  mineBubble: { backgroundColor: '#38c99b', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#222b35', borderBottomLeftRadius: 4 },
  mineMessageText: { color: '#07110e', fontSize: 16, lineHeight: 21 },
  otherMessageText: { color: '#f1f4f8', fontSize: 16, lineHeight: 21 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#202834', backgroundColor: '#101419' },
  composerInput: { flex: 1, minHeight: 46, maxHeight: 110, color: '#f7f9fc', backgroundColor: '#1c232c', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16 },
  sendButton: { height: 46, borderRadius: 12, marginLeft: 9, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#38c99b' },
  sendText: { color: '#07110e', fontWeight: '800' },
});
