import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ActivityIndicator, 
  StatusBar, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  Image, 
  Dimensions, 
  Linking,
  Animated,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { 
  Merriweather_400Regular, 
  Merriweather_700Bold 
} from '@expo-google-fonts/merriweather';
import { 
  JetBrainsMono_400Regular 
} from '@expo-google-fonts/jetbrains-mono';

// Altura de barra de estado para evitar solapamiento con reloj, WiFi y notch
const STATUSBAR_HEIGHT = Platform.OS === 'android' 
  ? (StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 30) 
  : (Platform.OS === 'ios' ? 44 : 10);

// URL del backend: lee de .env (EXPO_PUBLIC_API_URL) o usa IP local por defecto
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.200.38.48:8000";

// Portadas oficiales del libro en assets
const COVER_OUTER = require('./assets/portada2.jpg');
const COVER_INNER = require('./assets/LaVoluntadDeLasCenizas.jpg');

type ActionOption = {
  label: string;
  approach: "agresivo" | "sigilo" | "analitico" | "desesperado" | string;
  risk_level: "bajo" | "medio" | "critico" | string;
};

type VirginiaState = {
  status: "hostil" | "tensa" | "neutral" | "leal" | string;
  intensity: number;
  notes: string;
  current_agenda?: string;
};

type SceneTempo = "calma_narrativa" | "tension_latente" | "frenetico" | string;

type SavedGame = {
  session_id: string;
  last_updated: string;
  turn_number?: number;
  chapter_number?: number;
  chapter_title?: string;
  act_title?: string;
  health?: number;
  entropy?: number;
  virginia_status?: string;
  active_branch?: string;
  is_game_over?: boolean;
};

type StoryPassage = {
  turn_number: number;
  act_title: string;
  chapter_number: number;
  chapter_title: string;
  narrative: string;
  player_choice: string;
  created_at?: string;
};

type BookView = 'COVER' | 'FRONTISPIECE' | 'READER';
type ThemeMode = 'dark' | 'paper';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  // Vista actual del libro y tema de lectura (Moon Reader Sepia vs OLED Dark)
  const [bookView, setBookView] = useState<BookView>('COVER');
  const [themeMode, setThemeMode] = useState<ThemeMode>('paper'); // 'paper' = Moon+ Reader / 'dark' = OLED

  // Estado de la novela en curso (Arquímedes)
  const [sessionId, setSessionId] = useState("");
  const [actTitle, setActTitle] = useState("Acto I: La Academia");
  const [actNumber, setActNumber] = useState(1);
  const [climaxPhase, setClimaxPhase] = useState("Inmersión Analítica");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterTitle, setChapterTitle] = useState("El Umbral de la Academia");
  const [salud, setSalud] = useState(100);
  const [entropia, setEntropia] = useState(0);
  const [virginia, setVirginia] = useState<VirginiaState>({
    status: "neutral",
    intensity: 5,
    notes: "Compañera de ingreso a la Academia",
    current_agenda: "Sobrevivir a la prueba de admisión de la Academia"
  });
  const [inventory, setInventory] = useState<string[]>([]);
  const [loreLedger, setLoreLedger] = useState<string[]>([]);
  const [confirmedFacts, setConfirmedFacts] = useState<string[]>([]);
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [activeBranch, setActiveBranch] = useState("Cadete de la Academia");
  const [secretRouteUnlocked, setSecretRouteUnlocked] = useState(false);

  const [narrativa, setNarrativa] = useState("");
  const [isCrossroad, setIsCrossroad] = useState(false);
  const [opciones, setOpciones] = useState<ActionOption[]>([]);
  const [sceneTempo, setSceneTempo] = useState<SceneTempo>("tension_latente");
  const [artPrompt, setArtPrompt] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  
  // Control de flujo y errores
  const [loading, setLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState("EXPANDIENDO LÍNEA TEMPORAL...");
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modales
  const [showLoopsModal, setShowLoopsModal] = useState(false);
  const [savedGamesList, setSavedGamesList] = useState<SavedGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // Panel lateral de capítulos (Moon+ Reader style)
  const [showChaptersDrawer, setShowChaptersDrawer] = useState(false);
  const [passagesHistory, setPassagesHistory] = useState<StoryPassage[]>([]);
  const [loadingPassages, setLoadingPassages] = useState(false);
  const [viewingPastPassage, setViewingPastPassage] = useState<StoryPassage | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Animación de cambio de página (Page Flip / Slide Transition)
  const pageSlideAnim = useRef(new Animated.Value(0)).current;
  const pageFadeAnim = useRef(new Animated.Value(1)).current;

  // 1. CARGA DE TIPOGRAFÍAS
  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        Merriweather_400Regular,
        Merriweather_700Bold,
        JetBrainsMono_400Regular,
      });
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  // 2. INICIALIZACIÓN INTELIGENTE (Reanudar última o crear nueva)
  useEffect(() => {
    if (fontsLoaded) {
      inicializarSesion();
    }
  }, [fontsLoaded]);

  const aplicarTurnoEnPantalla = (data: any, nuevaSesionId?: string) => {
    if (nuevaSesionId) setSessionId(nuevaSesionId);
    else if (data.session_id) setSessionId(data.session_id);

    setSalud(data.health ?? 100);
    setEntropia(data.entropy ?? 0);
    setNarrativa(data.narrative ?? "");
    setOpciones(data.options ?? []);
    setIsCrossroad(Boolean(data.is_crossroad));
    setChapterNumber(data.chapter_number ?? 1);
    setChapterTitle(data.chapter_title ?? "El Umbral de la Academia");
    setActTitle(data.act_title ?? "Acto I: La Academia");
    if (data.act_number) setActNumber(data.act_number);
    if (data.climax_phase) setClimaxPhase(data.climax_phase);
    
    if (data.virginia) setVirginia(data.virginia);
    if (data.inventory) setInventory(data.inventory);
    if (data.lore_ledger) setLoreLedger(data.lore_ledger);
    if (data.confirmed_facts) setConfirmedFacts(data.confirmed_facts);
    if (data.open_threads) setOpenThreads(data.open_threads);
    if (data.active_branch) setActiveBranch(data.active_branch);
    if (data.secret_route_unlocked !== undefined) setSecretRouteUnlocked(Boolean(data.secret_route_unlocked));
    if (data.scene_tempo) setSceneTempo(data.scene_tempo);
    
    if (data.art_prompt && data.art_prompt !== artPrompt) {
      setArtPrompt(data.art_prompt);
      setImageError(false);
    }

    setIsGameOver(Boolean(data.is_game_over));
    setGameOverReason(data.game_over_reason ?? null);
    setViewingPastPassage(null);

    // Auto-scroll suave arriba
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const inicializarSesion = async () => {
    setLoading(true);
    setLoadingStatusText("SINCRONIZANDO ARCHIVO DE ARQUÍMEDES...");
    setErrorMsg(null);

    try {
      const resp = await fetch(`${API_URL}/api/games`);
      if (resp.ok) {
        const games: SavedGame[] = await resp.json();
        if (games && games.length > 0) {
          await reanudarPartida(games[0].session_id);
          return;
        }
      }
      await comenzarNuevaNovela();
    } catch (err) {
      console.warn("Fallo al consultar partidas previas:", err);
      setErrorMsg(`No se pudo conectar con el motor en ${API_URL}. Revisa que el backend esté activo.`);
      setLoading(false);
    }
  };

  const reanudarPartida = async (id: string) => {
    setLoading(true);
    setLoadingStatusText("REANUDANDO REGISTRO DE ARQUÍMEDES...");
    setErrorMsg(null);
    setShowLoopsModal(false);

    try {
      const resp = await fetch(`${API_URL}/api/game/${id}`);
      if (!resp.ok) throw new Error(`Error ${resp.status} al cargar partida.`);
      const data = await resp.json();
      aplicarTurnoEnPantalla(data, id);
    } catch (error) {
      console.error("Error al reanudar partida:", error);
      setErrorMsg(`Error al reanudar ${id}. Puedes iniciar una nueva trayectoria.`);
    } finally {
      setLoading(false);
    }
  };

  const comenzarNuevaNovela = async () => {
    setLoading(true);
    setLoadingStatusText("ESTABLECIENDO INICIO CANÓNICO: EL UMBRAL DE LA ACADEMIA...");
    setIsGameOver(false);
    setGameOverReason(null);
    setErrorMsg(null);
    setShowLoopsModal(false);
    setViewingPastPassage(null);
    setBookView('READER');

    const nuevaSesion = `arquimedes_${Date.now()}`;

    try {
      const response = await fetch(`${API_URL}/api/start?session_id=${nuevaSesion}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Servidor devolvió código ${response.status}`);
      }

      const data = await response.json();
      aplicarTurnoEnPantalla(data, nuevaSesion);
    } catch (error) {
      console.error("Error al conectar con el motor cronal:", error);
      setErrorMsg(`No se pudo generar la nueva novela (${API_URL}).`);
    } finally {
      setLoading(false);
    }
  };

  const reiniciarNovelaActual = async () => {
    if (!sessionId) {
      comenzarNuevaNovela();
      return;
    }
    setLoading(true);
    setLoadingStatusText("REINICIANDO TRAYECTORIA DESDE EL UMBRAL DE LA ACADEMIA...");
    setIsGameOver(false);
    setGameOverReason(null);
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_URL}/api/start?session_id=${sessionId}&reiniciar=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error(`Código ${response.status}`);
      const data = await response.json();
      aplicarTurnoEnPantalla(data, sessionId);
    } catch (error) {
      console.error("Error al reiniciar novela:", error);
      setErrorMsg("Fallo al reiniciar la novela.");
    } finally {
      setLoading(false);
    }
  };

  const tomarDecision = async (textoDecision: string) => {
    if (loading || isGameOver) return;

    // Transición de cambio de página: deslizar hacia la izquierda
    Animated.parallel([
      Animated.timing(pageSlideAnim, { toValue: -30, duration: 140, useNativeDriver: true }),
      Animated.timing(pageFadeAnim, { toValue: 0.1, duration: 140, useNativeDriver: true })
    ]).start();

    setLoading(true);
    setLoadingStatusText(isCrossroad ? "PROCESANDO BIFURCACIÓN DE CAUSALIDAD..." : "AVANZANDO PÁGINA NARRATIVA...");
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_URL}/api/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId, 
          player_choice: textoDecision
        }) 
      });

      if (!response.ok) {
        throw new Error(`Servidor devolvió código ${response.status}`);
      }

      const data = await response.json();
      aplicarTurnoEnPantalla(data);

      // Deslizar nueva página desde la derecha
      pageSlideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(pageSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(pageFadeAnim, { toValue: 1, duration: 220, useNativeDriver: true })
      ]).start();

    } catch (error) {
      console.error("Error en el motor cronal:", error);
      setErrorMsg("Interferencia temporal: falló la transmisión de tu decisión.");
      pageSlideAnim.setValue(0);
      pageFadeAnim.setValue(1);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalBucles = async () => {
    setShowLoopsModal(true);
    setLoadingGames(true);
    try {
      const resp = await fetch(`${API_URL}/api/games`);
      if (resp.ok) {
        const games = await resp.json();
        setSavedGamesList(games);
      }
    } catch (err) {
      console.warn("Error cargando lista de bucles:", err);
    } finally {
      setLoadingGames(false);
    }
  };

  const eliminarBucle = async (idAEliminar: string) => {
    try {
      await fetch(`${API_URL}/api/game/${idAEliminar}`, { method: 'DELETE' });
      setSavedGamesList(prev => prev.filter(g => g.session_id !== idAEliminar));
      if (sessionId === idAEliminar) {
        await comenzarNuevaNovela();
      }
    } catch (err) {
      console.error("Error eliminando bucle:", err);
    }
  };

  const abrirDrawerCapitulos = async () => {
    setShowChaptersDrawer(true);
    setLoadingPassages(true);
    try {
      const resp = await fetch(`${API_URL}/api/game/${sessionId}/chapters`);
      if (resp.ok) {
        const data = await resp.json();
        setPassagesHistory(data);
      }
    } catch (err) {
      console.warn("Error cargando capítulos pasados:", err);
    } finally {
      setLoadingPassages(false);
    }
  };

  // Paleta diegética según tema (Paper / Moon Reader vs OLED Dark)
  const isPaper = themeMode === 'paper';
  const theme = {
    bg: isPaper ? '#F4EEDD' : '#050505',
    cardBg: isPaper ? '#EAE2CF' : '#111111',
    border: isPaper ? '#D5CBBA' : '#1F1F1F',
    textMain: isPaper ? '#1E1915' : '#E5E7EB',
    textSecondary: isPaper ? '#665747' : '#9CA3AF',
    textMuted: isPaper ? '#827362' : '#6B7280',
    headerTitle: isPaper ? '#110D0A' : '#F3F4F6',
    hudBg: isPaper ? '#E8DFCC' : '#0A0A0A',
    accentAmber: isPaper ? '#964B00' : '#D97706',
    accentBlue: isPaper ? '#2B579A' : '#38BDF8',
    prose: isPaper ? '#1A1612' : '#E2E8F0',
    barStyle: (isPaper ? 'dark-content' : 'light-content') as 'dark-content' | 'light-content',
    optionBtnBg: isPaper ? '#ECE4D2' : '#141414',
    optionBtnBorder: isPaper ? '#D0C5B0' : '#222222',
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'bajo': return isPaper ? '#15803D' : '#10B981';
      case 'medio': return isPaper ? '#B45309' : '#F59E0B';
      case 'critico': return isPaper ? '#B91C1C' : '#EF4444';
      default: return isPaper ? '#78716C' : '#666666';
    }
  };

  const getTempoColor = (tempo: SceneTempo) => {
    switch (tempo) {
      case 'frenetico': return isPaper ? '#B91C1C' : '#EF4444';
      case 'tension_latente': return isPaper ? '#B45309' : '#F59E0B';
      case 'calma_narrativa': return isPaper ? '#1D4ED8' : '#3B82F6';
      default: return isPaper ? '#78716C' : '#777777';
    }
  };

  const getVirginiaColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'leal': return isPaper ? '#15803D' : '#10B981';
      case 'neutral': return isPaper ? '#B45309' : '#F59E0B';
      case 'tensa': return isPaper ? '#C2410C' : '#FB923C';
      case 'hostil': return isPaper ? '#B91C1C' : '#EF4444';
      default: return isPaper ? '#78716C' : '#9CA3AF';
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#050505' }]}>
        <ActivityIndicator size="large" color="#4A4A4A" />
      </View>
    );
  }

  // URL de ilustración con FLUX vía Pollinations
  const imageUrl = artPrompt && !imageError
    ? `https://image.pollinations.ai/prompt/${encodeURIComponent(
        artPrompt + " cinematic sci-fi dark gritty concept art, high detail, masterpiece, 8k"
      )}?width=900&height=450&nologo=true`
    : null;

  // -------------------------------------------------------------
  // VISTA 1: PORTADA EXTERIOR DEL LIBRO (TAPA DURA)
  // -------------------------------------------------------------
  if (bookView === 'COVER') {
    return (
      <View style={[styles.coverScreenContainer, { backgroundColor: '#080808' }]}>
        <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
        <ScrollView contentContainerStyle={styles.coverScreenScroll}>
          <View style={styles.bookPhysicalCard}>
            <Image 
              source={COVER_OUTER} 
              style={styles.bookPhysicalImage} 
              resizeMode="contain" 
            />
          </View>

          <Text style={styles.coverAppTitle}>ARQUÍMEDES</Text>
          <Text style={styles.coverAppSubtitle}>LIBRO I: LA VOLUNTAD DE LAS CENIZAS</Text>
          <Text style={styles.coverAppAuthor}>POR OSCAR BUENO</Text>

          <TouchableOpacity 
            style={styles.coverPrimaryButton}
            onPress={() => setBookView('FRONTISPIECE')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.coverPrimaryButtonText}>ABRIR LIBRO</Text>
              <Feather name="chevron-right" size={16} color="#38BDF8" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.coverSecondaryButton}
            onPress={() => setBookView('READER')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="book-open" size={14} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.coverSecondaryButtonText}>IR DIRECTO AL LECTOR</Text>
            </View>
          </TouchableOpacity>

          {/* DESCARGA DIRECTA DE LA EDICIÓN COMPLETA */}
          <TouchableOpacity 
            style={styles.coverDownloadEpubButton}
            onPress={() => Linking.openURL(`${API_URL}/api/book/download/complete`)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="download" size={14} color="#F59E0B" style={{ marginRight: 8 }} />
              <Text style={styles.coverDownloadEpubText}>DESCARGAR LIBRO I COMPLETO (EPUB)</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // VISTA 2: PORTADILLA INTERIOR (FRONTISPICIO CON EPÍGRAFE)
  // -------------------------------------------------------------
  if (bookView === 'FRONTISPIECE') {
    return (
      <View style={[styles.coverScreenContainer, { backgroundColor: isPaper ? '#F4EEDD' : '#080808' }]}>
        <StatusBar barStyle={isPaper ? 'dark-content' : 'light-content'} translucent={true} backgroundColor="transparent" />
        <ScrollView contentContainerStyle={styles.coverScreenScroll}>
          <View style={styles.frontispieceCard}>
            <Image 
              source={COVER_INNER} 
              style={styles.frontispieceImage} 
              resizeMode="contain" 
            />
          </View>

          <View style={styles.frontispieceQuoteBox}>
            <Text style={[styles.frontispieceQuoteText, { color: theme.textMain }]}>
              «Dame un punto de apoyo y moveré el mundo.»
            </Text>
            <Text style={[styles.frontispieceQuoteAuthor, { color: theme.accentAmber }]}>
              — ARQUÍMEDES
            </Text>
          </View>

          <Text style={[styles.frontispieceIntroNote, { color: theme.textSecondary }]}>
            En el umbral de la Academia Militar, Oscar y Virginia se enfrentan a un imperio forjado en cenizas. Nadie comprende todavía qué leyes de la realidad están a punto de quebrarse.
          </Text>

          <TouchableOpacity 
            style={[styles.coverPrimaryButton, { backgroundColor: isPaper ? '#3B2F25' : '#1E293B', borderColor: theme.accentAmber }]}
            onPress={() => setBookView('READER')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.coverPrimaryButtonText, { color: isPaper ? '#F4EEDD' : '#38BDF8' }]}>
                COMENZAR CAPÍTULO 1
              </Text>
              <Feather name="chevron-right" size={16} color={isPaper ? '#F4EEDD' : '#38BDF8'} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.coverSecondaryButton}
            onPress={() => setBookView('COVER')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="chevron-left" size={14} color={theme.textMuted} style={{ marginRight: 4 }} />
              <Text style={[styles.coverSecondaryButtonText, { color: theme.textMuted }]}>
                VOLVER A LA TAPA
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // VISTA 3: EL LECTOR DE LA NOVELA (MOON+ READER EXPERIENCE)
  // -------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.barStyle} translucent={true} backgroundColor="transparent" />
      
      {/* ----------------- BARRA 1: CONTROL SUPERIOR LIMPIO ----------------- */}
      <View style={[styles.mainTopBar, { backgroundColor: theme.hudBg, borderBottomColor: theme.border }]}>
        {/* Botón Drawer Capítulos (Moon Reader style) */}
        <TouchableOpacity 
          style={styles.navBarButton}
          onPress={abrirDrawerCapitulos}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
        >
          <Feather name="menu" size={17} color={theme.textMain} style={{ marginRight: 6 }} />
          <Text style={[styles.navBarButtonText, { color: theme.textMain }]}>ÍNDICE</Text>
        </TouchableOpacity>

        {/* Título Central enfocado en el ACTO actual */}
        <View style={styles.navBarTitleContainer}>
          <Text style={[styles.navBarTitle, { color: theme.headerTitle }]}>ARQUÍMEDES</Text>
          <Text style={[styles.navBarSubTitle, { color: theme.accentAmber }]}>
            {(actTitle || "ACTO I").toUpperCase()}
          </Text>
        </View>

        {/* Botones Derecha: Tema Claro/Oscuro + Portada + Trayectorias (Estéticos Unicolor) */}
        <View style={styles.navBarActionsRight}>
          {/* Toggle Modo Claro (Moon Reader Sepia) vs Oscuro */}
          <TouchableOpacity 
            style={styles.navBarIconButton}
            onPress={() => setThemeMode(isPaper ? 'dark' : 'paper')}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel="Cambiar tema de lectura"
          >
            <Feather 
              name={isPaper ? "moon" : "sun"} 
              size={18} 
              color={theme.textMain} 
            />
          </TouchableOpacity>

          {/* Volver a ver Portada */}
          <TouchableOpacity 
            style={styles.navBarIconButton}
            onPress={() => setBookView('COVER')}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel="Ver tapa del libro"
          >
            <Feather 
              name="book-open" 
              size={18} 
              color={theme.textMain} 
            />
          </TouchableOpacity>

          {/* Modal Partidas Guardadas */}
          <TouchableOpacity 
            style={styles.navBarIconButton}
            onPress={abrirModalBucles}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel="Registro de trayectorias"
          >
            <Feather 
              name="bookmark" 
              size={18} 
              color={theme.textMain} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ----------------- BARRA 2: CINTA DE ESTADO TÁCTICO (SLIM RIBBON) ----------------- */}
      <View style={[styles.statusRibbon, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <View style={styles.vitalsGroup}>
          <View style={[styles.vitalBadge, { borderColor: salud <= 30 ? '#EF4444' : theme.border }]}>
            <Text style={[styles.vitalBadgeText, { color: salud <= 30 ? '#EF4444' : theme.textMain }]}>
              HP {salud}%
            </Text>
          </View>

          <View style={[styles.vitalBadge, { borderColor: entropia >= 50 ? '#F59E0B' : theme.border }]}>
            <Text style={[styles.vitalBadgeText, { color: entropia >= 50 ? '#F59E0B' : theme.textSecondary }]}>
              ENT {entropia}%
            </Text>
          </View>
        </View>

        {/* Indicador de Cercanía al Clímax del Acto */}
        <View style={[styles.climaxBadge, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
          <Text style={[styles.climaxBadgeText, { color: theme.accentAmber }]} numberOfLines={1}>
            ◈ {climaxPhase.toUpperCase()}
          </Text>
        </View>

        {/* Píldora Virginia (Abre Dossier al pulsar) */}
        <TouchableOpacity 
          style={[styles.virginiaSlimPill, { borderColor: getVirginiaColor(virginia.status) }]}
          onPress={() => setShowDossierModal(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.virginiaSlimPillText, { color: getVirginiaColor(virginia.status) }]}>
            VIRGINIA ({virginia.intensity}/10)
          </Text>
        </TouchableOpacity>
      </View>

      {/* ----------------- LIENZO NARRATIVO TIPO LIBRO ----------------- */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.narrativeContainer}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Banner si el usuario está leyendo un capítulo pasado */}
        {viewingPastPassage && (
          <View style={[styles.pastChapterBanner, { backgroundColor: theme.cardBg, borderColor: theme.accentAmber }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Feather name="clock" size={13} color={theme.accentAmber} style={{ marginRight: 6 }} />
              <Text style={[styles.pastChapterBannerTitle, { color: theme.accentAmber }]}>
                REVISANDO HISTORIAL DE CAPÍTULOS
              </Text>
            </View>
            <Text style={[styles.pastChapterBannerSub, { color: theme.textSecondary }]}>
              {viewingPastPassage.act_title} • Turno {viewingPastPassage.turn_number}
            </Text>
            <TouchableOpacity 
              style={[styles.returnPresentButton, { backgroundColor: theme.accentAmber }]}
              onPress={() => setViewingPastPassage(null)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="arrow-left" size={13} color="#080808" style={{ marginRight: 6 }} />
                <Text style={styles.returnPresentButtonText}>VOLVER A LA PÁGINA ACTUAL</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Cabecera Literaria del Libro */}
        <View style={styles.bookHeader}>
          <Text style={[styles.bookMainTitle, { color: theme.textMuted }]}>ARQUÍMEDES</Text>
          <Text style={[styles.bookSagaSubtitle, { color: theme.accentBlue }]}>LIBRO I: LA VOLUNTAD DE LAS CENIZAS</Text>
          <Text style={[styles.actSubtitle, { color: theme.accentAmber }]}>
            ◈ {(viewingPastPassage ? viewingPastPassage.act_title : actTitle).toUpperCase()} ◈
          </Text>
          <Text style={[styles.chapterHeaderTitle, { color: theme.headerTitle }]}>
            {viewingPastPassage ? viewingPastPassage.chapter_title : chapterTitle}
          </Text>
          <Text style={[styles.climaxPhaseTag, { color: theme.textMuted }]}>
            Arco Dramático: {climaxPhase}
          </Text>
          <View style={[styles.bookHeaderDivider, { backgroundColor: theme.border }]} />
        </View>

        {/* Mensaje de error si la conexión falla */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={inicializarSesion}>
              <Text style={styles.retryButtonText}>[ RECONECTAR MOTOR ]</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Prosa Principal de la Novela con animación de paso de página (Sin visor de entorno intrusivo) */}
        <Animated.View style={{ opacity: pageFadeAnim, transform: [{ translateX: pageSlideAnim }] }}>
          <Text style={[styles.prose, { color: theme.prose }]}>
            {viewingPastPassage 
              ? viewingPastPassage.narrative 
              : (narrativa || (loading ? "Sintonizando los muros de la Academia Militar..." : ""))}
          </Text>
        </Animated.View>

        {/* ----------------- PANTALLA DE GAME OVER ----------------- */}
        {!viewingPastPassage && isGameOver ? (
          <View style={styles.gameOverContainer}>
            <Text style={styles.gameOverTitle}>// FRACTURA ONTOLÓGICA // BUCLE COLAPSADO</Text>
            <Text style={styles.gameOverReason}>
              {gameOverReason || "Tus constantes biológicas o temporales han llegado a cero. Esta iteración ha terminado."}
            </Text>
            <TouchableOpacity 
              style={styles.restartButton} 
              onPress={reiniciarNovelaActual}
              activeOpacity={0.8}
            >
              <Text style={styles.restartButtonText}>[ REINICIAR DESDE EL UMBRAL DE LA ACADEMIA ]</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ----------------- DECISIONES O CONTINUACIÓN ----------------- */}
        {!viewingPastPassage && !isGameOver ? (
          <View style={styles.optionsWrapper}>
            {loading && (
              <View style={[styles.loadingBanner, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.accentAmber} style={{ marginRight: 10 }} />
                <Text style={[styles.loadingBannerText, { color: theme.textSecondary }]}>{loadingStatusText}</Text>
              </View>
            )}

            {/* CASO A: CONTINUACIÓN DE LECTURA (1 BOTÓN FLUIDO TIPO LIBRO) */}
            {!isCrossroad && opciones.length <= 1 && (
              <TouchableOpacity 
                style={[styles.continueButton, { backgroundColor: theme.optionBtnBg, borderColor: theme.border }, loading && styles.optionButtonDisabled]}
                onPress={() => tomarDecision(opciones[0]?.label || "Continuar leyendo...")}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={styles.continueButtonInner}>
                  <Text style={[styles.continueButtonText, { color: theme.textMain }]}>
                    {opciones[0]?.label || "CONTINUAR LEYENDO ❯"}
                  </Text>
                  <Text style={[styles.continueButtonSubtext, { color: theme.textMuted }]}>
                    Avanzar página narrativa • La trama se desenvuelve
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* CASO B: ENCRUCIJADA TÁCTICA (3 O 4 CARTAS DE DECISIÓN) */}
            {(isCrossroad || opciones.length > 1) && (
              <View style={styles.crossroadContainer}>
                <View style={[styles.crossroadBanner, { backgroundColor: theme.cardBg, borderColor: theme.accentAmber }]}>
                  <Text style={[styles.crossroadBadge, { color: theme.accentAmber }]}>⚡ PUNTO DE DIVERGENCIA CAUSAL</Text>
                  <Text style={[styles.crossroadNotice, { color: theme.textSecondary }]}>
                    Tus decisiones ramificarán la historia. Oscar no está predestinado: tú eliges su camino.
                  </Text>
                </View>

                {opciones.map((opcion, index) => {
                  const riskColor = getRiskColor(opcion.risk_level);
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={[
                        styles.optionButton,
                        { backgroundColor: theme.optionBtnBg, borderColor: theme.optionBtnBorder },
                        loading && styles.optionButtonDisabled
                      ]} 
                      onPress={() => tomarDecision(opcion.label)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionHeader}>
                        <View style={[styles.approachBadge, { borderColor: `${riskColor}55`, backgroundColor: isPaper ? '#E5DDC9' : '#1A1A1A' }]}>
                          <Text style={[styles.approachText, { color: riskColor }]}>
                            [{opcion.approach.toUpperCase()}]
                          </Text>
                        </View>
                        <Text style={[styles.riskText, { color: riskColor }]}>
                          PELIGRO: {opcion.risk_level.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.optionText, { color: theme.textMain }, loading && styles.optionTextMuted]}>
                        {opcion.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ----------------- MODAL LATERAL DE CAPÍTULOS (MOON+ READER SIDEBAR) ----------------- */}
      <Modal
        visible={showChaptersDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChaptersDrawer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.chaptersDrawerContent, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.headerTitle }]}>ÍNDICE DE CAPÍTULOS</Text>
                <Text style={[styles.dossierSubTitle, { color: theme.accentAmber }]}>RELEER ACONTECIMIENTOS PASADOS</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowChaptersDrawer(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={20} color={theme.accentAmber} />
              </TouchableOpacity>
            </View>

            {/* Botón 1: Descargar Obra Completa Oficial */}
            <TouchableOpacity 
              style={[styles.epubBannerButton, { backgroundColor: isPaper ? '#3B2F25' : '#1E293B', borderColor: '#F59E0B', marginBottom: 10 }]}
              onPress={() => Linking.openURL(`${API_URL}/api/book/download/complete`)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Feather name="download" size={15} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.epubBannerButtonText, { color: isPaper ? '#F4EEDD' : '#F59E0B' }]}>
                  DESCARGAR LIBRO I COMPLETO (OBRA ÍNTEGRA)
                </Text>
              </View>
              <Text style={[styles.epubBannerButtonSub, { color: isPaper ? '#C5B9A4' : '#94A3B8' }]}>
                Todos los capítulos (1 al 10) con portada y frontispicio para Moon+ Reader
              </Text>
            </TouchableOpacity>

            {/* Botón 2: Exportar Crónica de la Sesión en curso */}
            <TouchableOpacity 
              style={[styles.epubBannerButton, { backgroundColor: isPaper ? '#E8DFCC' : '#0F172A', borderColor: theme.border, marginBottom: 12 }]}
              onPress={() => Linking.openURL(`${API_URL}/api/game/${sessionId}/export/epub`)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Feather name="bookmark" size={13} color={theme.textMuted} style={{ marginRight: 8 }} />
                <Text style={[styles.epubBannerButtonText, { color: theme.textMain, fontSize: 11 }]}>
                  Exportar Mi Crónica Personal (Turnos Jugados)
                </Text>
              </View>
              <Text style={[styles.epubBannerButtonSub, { color: theme.textMuted }]}>
                Guarda los capítulos que llevas vividos con tus propias decisiones
              </Text>
            </TouchableOpacity>

            {loadingPassages ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.accentAmber} />
                <Text style={{ marginTop: 10, color: theme.textSecondary, fontFamily: 'JetBrainsMono_400Regular', fontSize: 11 }}>
                  Recuperando crónica de la Academia...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                {passagesHistory.length === 0 ? (
                  <View style={{ padding: 20 }}>
                    <Text style={[styles.dossierEmpty, { color: theme.textSecondary }]}>
                      Capítulo 1: El Umbral de la Academia (En curso)
                    </Text>
                  </View>
                ) : (
                  passagesHistory.map((item, idx) => {
                    const isCurrent = idx === passagesHistory.length - 1;
                    return (
                      <TouchableOpacity 
                        key={idx}
                        style={[
                          styles.chapterHistoryRow, 
                          { borderBottomColor: theme.border },
                          isCurrent && { backgroundColor: isPaper ? '#E8DFCC' : '#151515' }
                        ]}
                        onPress={() => {
                          setViewingPastPassage(item);
                          setShowChaptersDrawer(false);
                          setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.chapterHistoryNumber, { color: theme.accentAmber }]}>
                            Turno {item.turn_number} • {item.act_title}
                          </Text>
                          <Text style={[styles.chapterHistoryTitle, { color: theme.textMain }]}>
                            {item.chapter_title}
                          </Text>
                          <Text style={[styles.chapterHistorySnippet, { color: theme.textMuted }]} numberOfLines={1}>
                            "{item.player_choice || 'Avance de lectura'}"
                          </Text>
                        </View>
                        {isCurrent && (
                          <Text style={[styles.chapterHistoryCurrentBadge, { color: theme.accentAmber }]}>
                            ACTUAL ✔
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={[styles.closeDrawerBottomBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => setShowChaptersDrawer(false)}
            >
              <Text style={[styles.closeDrawerBottomBtnText, { color: theme.textMain }]}>CERRAR ÍNDICE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ----------------- MODAL DE TRAYECTORIAS / PARTIDAS GUARDADAS ----------------- */}
      <Modal
        visible={showLoopsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLoopsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.headerTitle }]}>REGISTRO DE TRAYECTORIAS (ARQUÍMEDES)</Text>
              <TouchableOpacity 
                onPress={() => setShowLoopsModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={20} color={theme.accentAmber} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.newLoopButton} 
              onPress={comenzarNuevaNovela}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="plus-circle" size={13} color="#38BDF8" style={{ marginRight: 8 }} />
                <Text style={styles.newLoopButtonText}>COMENZAR NUEVA TRAYECTORIA DESDE EL INICIO CANÓNICO</Text>
              </View>
            </TouchableOpacity>

            {/* Descarga Directa del Libro Completo */}
            <TouchableOpacity 
              style={[styles.epubBannerButton, { backgroundColor: isPaper ? '#3B2F25' : '#1E293B', borderColor: '#F59E0B', marginBottom: 16 }]}
              onPress={() => Linking.openURL(`${API_URL}/api/book/download/complete`)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Feather name="download" size={15} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.epubBannerButtonText, { color: isPaper ? '#F4EEDD' : '#F59E0B' }]}>
                  DESCARGAR LIBRO I COMPLETO (OBRA ÍNTEGRA)
                </Text>
              </View>
              <Text style={[styles.epubBannerButtonSub, { color: isPaper ? '#C5B9A4' : '#94A3B8' }]}>
                Los 10 capítulos oficiales con portada y frontispicio para Moon+ Reader
              </Text>
            </TouchableOpacity>

            <Text style={[styles.savedGamesSectionTitle, { color: theme.textMuted }]}>
              TRAYECTORIAS REGISTRADAS EN LA BASE DE DATOS:
            </Text>

            {loadingGames ? (
              <ActivityIndicator size="small" color={theme.accentAmber} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={styles.savedGamesList}>
                {savedGamesList.length === 0 ? (
                  <Text style={[styles.dossierEmpty, { color: theme.textSecondary }]}>No hay otras trayectorias registradas.</Text>
                ) : (
                  savedGamesList.map((game) => (
                    <View 
                      key={game.session_id} 
                      style={[
                        styles.savedGameCard,
                        { backgroundColor: theme.cardBg, borderColor: theme.border },
                        sessionId === game.session_id && { borderColor: theme.accentAmber }
                      ]}
                    >
                      <View style={styles.savedGameCardHeader}>
                        <Text style={[styles.savedGameCardTitle, { color: theme.headerTitle }]}>
                          {game.chapter_title || `Capítulo ${game.chapter_number || 1}`}
                        </Text>
                        {sessionId === game.session_id && (
                          <View style={[styles.currentBadge, { backgroundColor: isPaper ? '#E5DDC9' : '#1A1A1A', borderColor: theme.accentAmber }]}>
                            <Text style={[styles.currentBadgeText, { color: theme.accentAmber }]}>ACTUAL</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.savedGameCardSub, { color: theme.textSecondary }]}>
                        {game.act_title || "Acto I"} • Rama: {game.active_branch || "Cadete"} • Salud: {game.health ?? 100}%
                      </Text>
                      <Text style={[styles.savedGameCardDate, { color: theme.textMuted }]}>
                        ID: {game.session_id}
                      </Text>

                      <View style={styles.savedGameCardActions}>
                        <TouchableOpacity 
                          style={[styles.resumeGameButton, { borderColor: theme.accentAmber }]}
                          onPress={() => {
                            reanudarPartida(game.session_id);
                            setBookView('READER');
                          }}
                        >
                          <Text style={[styles.resumeGameButtonText, { color: theme.accentAmber }]}>[ CONTINUAR LEYENDO ]</Text>
                        </TouchableOpacity>

                        {/* BOTÓN DESCARGA DIRECTA DE EPUB */}
                        <TouchableOpacity 
                          style={[styles.savedGameEpubButton, { backgroundColor: isPaper ? '#3B2F25' : '#1E293B', borderColor: theme.accentBlue }]}
                          onPress={() => Linking.openURL(`${API_URL}/api/game/${game.session_id}/export/epub`)}
                          activeOpacity={0.7}
                        >
                          <Feather name="download" size={12} color={isPaper ? '#F4EEDD' : '#38BDF8'} style={{ marginRight: 4 }} />
                          <Text style={[styles.savedGameEpubButtonText, { color: isPaper ? '#F4EEDD' : '#38BDF8' }]}>EPUB</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.deleteGameButton}
                          onPress={() => eliminarBucle(game.session_id)}
                          hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Feather name="trash-2" size={13} color="#F87171" style={{ marginRight: 4 }} />
                          <Text style={styles.deleteGameButtonText}>Borrar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ----------------- MODAL DOSSIER & SISTEMA DE CONTINUIDAD ----------------- */}
      <Modal
        visible={showDossierModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDossierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.headerTitle }]}>DOSSIER TÁCTICO & CONTINUIDAD</Text>
                <Text style={[styles.dossierSubTitle, { color: theme.accentAmber }]}>ARQUÍMEDES // DOCUMENTO MAESTRO</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowDossierModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={20} color={theme.accentAmber} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Botón Descargar Libro Completo */}
              <TouchableOpacity 
                style={[styles.exportEpubButton, { backgroundColor: isPaper ? '#3B2F25' : '#0F172A', borderColor: '#F59E0B', marginBottom: 12 }]} 
                onPress={() => Linking.openURL(`${API_URL}/api/book/download/complete`)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Feather name="download" size={15} color="#F59E0B" style={{ marginRight: 8 }} />
                  <Text style={[styles.exportEpubButtonText, { color: isPaper ? '#F4EEDD' : '#F59E0B' }]}>
                    DESCARGAR LIBRO I COMPLETO (OBRA ÍNTEGRA)
                  </Text>
                </View>
                <Text style={[styles.exportEpubButtonSubtext, { color: isPaper ? '#C5B9A4' : '#94A3B8' }]}>
                  Todos los capítulos con portada y frontispicio para Apple Books y Moon+ Reader
                </Text>
              </TouchableOpacity>

              {/* Botón Exportar Mi Crónica Personal de la Partida */}
              <TouchableOpacity 
                style={[styles.exportEpubButton, { backgroundColor: isPaper ? '#E8DFCC' : '#1E293B', borderColor: theme.border }]} 
                onPress={() => Linking.openURL(`${API_URL}/api/game/${sessionId}/export/epub`)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Feather name="bookmark" size={13} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <Text style={[styles.exportEpubButtonText, { color: theme.textMain, fontSize: 11 }]}>
                    Exportar Mi Crónica Personal (Turnos Jugados)
                  </Text>
                </View>
                <Text style={[styles.exportEpubButtonSubtext, { color: theme.textMuted }]}>
                  Compila las elecciones y escenas que llevas vividas en este bucle
                </Text>
              </TouchableOpacity>

              {/* Indicador de Ruta Secreta Universal */}
              {secretRouteUnlocked && (
                <View style={[styles.secretRouteBox, { backgroundColor: isPaper ? '#E6EEF8' : 'rgba(56, 189, 248, 0.08)', borderColor: theme.accentBlue }]}>
                  <Text style={[styles.secretRouteTitle, { color: theme.accentBlue }]}>✦ BRECHA CÓSMICA: RUTA SECRETA ACTIVADA ✦</Text>
                  <Text style={[styles.secretRouteDesc, { color: theme.textMain }]}>
                    Tus elecciones han conectado anomalías que desafían la cronología humana. Las Capas 3 y 4 están activas.
                  </Text>
                </View>
              )}

              {/* Sección Trayectoria Actual */}
              <View style={[styles.dossierSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.dossierSectionTitle, { color: theme.accentAmber }]}>// TRAYECTORIA DE OSCAR</Text>
                <View style={[styles.branchBadge, { backgroundColor: isPaper ? '#E5DDC9' : '#1A1A1A', borderColor: theme.border }]}>
                  <Text style={[styles.branchBadgeText, { color: theme.textMain }]}>{activeBranch.toUpperCase()}</Text>
                </View>
                <Text style={[styles.branchDescription, { color: theme.textSecondary }]}>
                  Las decisiones de Oscar en la Academia determinan si se acerca a Ares, se rebela contra las instituciones o forja un destino propio.
                </Text>
              </View>

              {/* Sección Virginia */}
              <View style={[styles.dossierSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.dossierSectionTitle, { color: theme.accentAmber }]}>// VIRGINIA (CADETE / AGENCIA PROPIA)</Text>
                <View style={styles.dossierStatusRow}>
                  <Text style={[styles.dossierFieldLabel, { color: theme.textMuted }]}>AFINIDAD / CONFIANZA:</Text>
                  <Text style={[styles.dossierFieldValue, { color: getVirginiaColor(virginia.status) }]}>
                    {virginia.status.toUpperCase()} ({virginia.intensity}/10)
                  </Text>
                </View>
                <View style={[styles.intensityBarTrack, { backgroundColor: isPaper ? '#DDD4BE' : '#222222' }]}>
                  <View 
                    style={[
                      styles.intensityBarFill, 
                      { 
                        width: `${Math.min(100, Math.max(10, virginia.intensity * 10))}%`,
                        backgroundColor: getVirginiaColor(virginia.status)
                      }
                    ]} 
                  />
                </View>
                <View style={[styles.agendaBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Text style={[styles.agendaLabel, { color: theme.textMuted }]}>OBJETIVO PROPIO DE VIRGINIA:</Text>
                  <Text style={[styles.agendaText, { color: theme.textMain }]}>
                    "{virginia.current_agenda || 'Sobrevivir a la prueba de admisión de la Academia'}"
                  </Text>
                </View>
                <Text style={[styles.dossierNotes, { color: theme.textSecondary }]}>
                  Observaciones: {virginia.notes || 'Compañera de ingreso a la Academia.'}
                </Text>
              </View>

              {/* Sección Hechos Confirmados (Continuidad) */}
              <View style={[styles.dossierSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.dossierSectionTitle, { color: theme.accentAmber }]}>// HECHOS CONFIRMADOS (CANON ESTABLECIDO)</Text>
                {confirmedFacts.length === 0 ? (
                  <Text style={[styles.dossierEmpty, { color: theme.textSecondary }]}>
                    - Oscar ha ingresado como cadete ordinario en la Academia Militar para enfrentar a Ares.
                  </Text>
                ) : (
                  confirmedFacts.map((fact, idx) => (
                    <View key={idx} style={styles.dossierItemRow}>
                      <Text style={[styles.dossierFactBullet, { color: isPaper ? '#15803D' : '#10B981' }]}>✔</Text>
                      <Text style={[styles.dossierFactText, { color: theme.textMain }]}>{fact}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Sección Posibilidades Abiertas (Continuidad) */}
              <View style={[styles.dossierSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.dossierSectionTitle, { color: theme.accentAmber }]}>// POSIBILIDADES ABIERTAS / INCÓGNITAS</Text>
                {openThreads.length === 0 ? (
                  <Text style={[styles.dossierEmpty, { color: theme.textSecondary }]}>
                    - ¿Qué verdades oculta la historia oficial de la Academia y la guerra contra Ares?
                  </Text>
                ) : (
                  openThreads.map((thread, idx) => (
                    <View key={idx} style={styles.dossierItemRow}>
                      <Text style={[styles.dossierThreadBullet, { color: theme.accentAmber }]}>?</Text>
                      <Text style={[styles.dossierThreadText, { color: theme.textSecondary }]}>{thread}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Sección Inventario */}
              <View style={[styles.dossierSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.dossierSectionTitle, { color: theme.accentAmber }]}>// EQUIPO & OBJETOS TÁCTICOS</Text>
                {inventory.length === 0 ? (
                  <Text style={[styles.dossierEmpty, { color: theme.textSecondary }]}>Suministros reglamentarios de cadete.</Text>
                ) : (
                  inventory.map((item, idx) => (
                    <Text key={idx} style={[styles.dossierItem, { color: theme.textMain }]}>• {item}</Text>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// -------------------------------------------------------------
// ESTILOS DE LA APLICACIÓN
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ----------------- VISTA DE PORTADA Y FRONTISPICIO -----------------
  coverScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverScreenScroll: {
    paddingTop: STATUSBAR_HEIGHT + 20,
    paddingBottom: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookPhysicalCard: {
    width: 250,
    height: 380,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 12,
    backgroundColor: '#111',
    overflow: 'hidden',
    marginBottom: 26,
  },
  bookPhysicalImage: {
    width: '100%',
    height: '100%',
  },
  frontispieceCard: {
    width: 240,
    height: 340,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  frontispieceImage: {
    width: '100%',
    height: '100%',
  },
  frontispieceQuoteBox: {
    marginVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  frontispieceQuoteText: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 26,
  },
  frontispieceQuoteAuthor: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 8,
  },
  frontispieceIntroNote: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 26,
    paddingHorizontal: 15,
  },
  coverAppTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 22,
    color: '#F3F4F6',
    letterSpacing: 6,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  coverAppSubtitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: '#D97706',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  coverAppAuthor: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: '#888888',
    letterSpacing: 3,
    marginBottom: 30,
    textAlign: 'center',
  },
  coverPrimaryButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 8,
    marginBottom: 14,
    minWidth: 240,
    alignItems: 'center',
  },
  coverPrimaryButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#38BDF8',
  },
  coverSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  coverSecondaryButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#777',
  },
  coverDownloadEpubButton: {
    borderWidth: 1,
    borderColor: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  coverDownloadEpubText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ----------------- BARRA 1: CONTROL SUPERIOR -----------------
  mainTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    minHeight: STATUSBAR_HEIGHT + 54,
  },
  navBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  navBarButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  navBarTitleContainer: {
    alignItems: 'center',
  },
  navBarTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  navBarSubTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  navBarActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBarIconButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ----------------- BARRA 2: CINTA DE ESTADO TÁCTICO -----------------
  statusRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  vitalsGroup: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  vitalBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  vitalBadgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    fontWeight: 'bold',
  },
  climaxBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 160,
  },
  climaxBadgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: 'bold',
  },
  climaxPhaseTag: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 4,
    textAlign: 'center',
  },
  virginiaSlimPill: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
  },
  virginiaSlimPillText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    fontWeight: 'bold',
  },

  // ----------------- LIENZO NARRATIVO -----------------
  narrativeContainer: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  pastChapterBanner: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    alignItems: 'center',
  },
  pastChapterBannerTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  pastChapterBannerSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    marginTop: 2,
    marginBottom: 10,
  },
  returnPresentButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  returnPresentButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  bookHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  bookMainTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 4,
    marginBottom: 4,
  },
  bookSagaSubtitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  actSubtitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
  },
  chapterHeaderTitle: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 21,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 14,
  },
  bookHeaderDivider: {
    width: 60,
    height: 1,
  },
  sceneIllustrationContainer: {
    marginBottom: 24,
    borderWidth: 1,
    overflow: 'hidden',
    borderRadius: 4,
  },
  sceneIllustration: {
    width: '100%',
    height: 220,
  },
  sceneIllustrationCaption: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    padding: 6,
    textAlign: 'center',
    letterSpacing: 1,
  },
  prose: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'justify',
    letterSpacing: 0.2,
    marginBottom: 32,
  },

  // ----------------- BOTÓN DE CONTINUACIÓN / OPCIONES -----------------
  optionsWrapper: {
    marginTop: 10,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
  },
  loadingBannerText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1,
  },
  continueButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  continueButtonInner: {
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  continueButtonSubtext: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  crossroadContainer: {
    marginTop: 8,
  },
  crossroadBanner: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    marginBottom: 14,
  },
  crossroadBadge: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  crossroadNotice: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  approachBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  approachText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    fontWeight: 'bold',
  },
  riskText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    fontWeight: 'bold',
  },
  optionText: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionTextMuted: {
    opacity: 0.5,
  },

  // ----------------- GAME OVER -----------------
  gameOverContainer: {
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginBottom: 20,
  },
  gameOverTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#EF4444',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  gameOverReason: {
    fontFamily: 'Merriweather_400Regular',
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  restartButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  restartButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 1,
  },

  // ----------------- ERROR BOX -----------------
  errorBox: {
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 14,
    borderRadius: 6,
    marginBottom: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  errorText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#EF4444',
    fontSize: 11,
    marginBottom: 10,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  retryButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // ----------------- MODALES COMUNES -----------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '85%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalCloseText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalScroll: {
    maxHeight: Dimensions.get('window').height * 0.65,
  },

  // ----------------- DRAWER DE CAPÍTULOS (MOON+ READER) -----------------
  chaptersDrawerContent: {
    width: '92%',
    maxHeight: '90%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
  },
  chapterHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  chapterHistoryNumber: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 2,
  },
  chapterHistoryTitle: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  chapterHistorySnippet: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
  },
  chapterHistoryCurrentBadge: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  epubBannerButton: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginBottom: 14,
    alignItems: 'center',
  },
  epubBannerButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  epubBannerButtonSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
  },
  closeDrawerBottomBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 12,
    alignItems: 'center',
  },
  closeDrawerBottomBtnText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // ----------------- TRAYECTORIAS / SAVED GAMES -----------------
  newLoopButton: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  newLoopButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  savedGamesSectionTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  savedGamesList: {
    maxHeight: 350,
  },
  savedGameCard: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 6,
    marginBottom: 12,
  },
  savedGameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  savedGameCardTitle: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 14,
    flex: 1,
  },
  currentBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    fontWeight: 'bold',
  },
  savedGameCardSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    marginBottom: 4,
  },
  savedGameCardDate: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    marginBottom: 10,
  },
  savedGameCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeGameButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  resumeGameButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  savedGameEpubButton: {
    flexDirection: 'row',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  savedGameEpubButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteGameButton: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#450A0A',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  deleteGameButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#F87171',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // ----------------- DOSSIER STYLES -----------------
  dossierSubTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  exportEpubButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
    alignItems: 'center',
  },
  exportEpubButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 3,
  },
  exportEpubButtonSubtext: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    textAlign: 'center',
  },
  secretRouteBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 18,
  },
  secretRouteTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  secretRouteDesc: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  dossierSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  dossierSectionTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
    fontWeight: '700',
  },
  branchBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  branchBadgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
  },
  branchDescription: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  dossierStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dossierFieldLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
  },
  dossierFieldValue: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
  },
  intensityBarTrack: {
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  intensityBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  agendaBox: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  agendaLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 2,
  },
  agendaText: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    fontStyle: 'italic',
  },
  dossierNotes: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    lineHeight: 15,
  },
  dossierEmpty: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    fontStyle: 'italic',
  },
  dossierItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dossierFactBullet: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    marginRight: 8,
    marginTop: 2,
  },
  dossierFactText: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  dossierThreadBullet: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    marginRight: 8,
    fontWeight: 'bold',
  },
  dossierThreadText: {
    fontFamily: 'Merriweather_400Regular',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  dossierItem: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    marginBottom: 4,
  },
});
