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
  Linking
} from 'react-native';
import * as Font from 'expo-font';
import { 
  Merriweather_400Regular, 
  Merriweather_700Bold 
} from '@expo-google-fonts/merriweather';
import { 
  JetBrainsMono_400Regular 
} from '@expo-google-fonts/jetbrains-mono';

// URL del servidor backend (Túnel HTTPS seguro accesible desde cualquier red 4G/5G/Wi-Fi)
const API_URL = "https://9c247aa0f2e90b.lhr.life";

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

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  // Estado de la novela en curso (Arquímedes)
  const [sessionId, setSessionId] = useState("");
  const [actTitle, setActTitle] = useState("Acto I: La Puerta de Hierro y Ceniza");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterTitle, setChapterTitle] = useState("Capítulo 1: El Umbral de la Academia");
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

  const scrollViewRef = useRef<ScrollView>(null);

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
    setChapterTitle(data.chapter_title ?? `Capítulo ${data.chapter_number ?? 1}: El Umbral de la Academia`);
    setActTitle(data.act_title ?? "Acto I: La Puerta de Hierro y Ceniza");
    
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
    setLoading(true);
    setLoadingStatusText(isCrossroad ? "PROCESANDO BIFURCACIÓN DE CAUSALIDAD..." : "AVANZANDO CAPÍTULO NARRATIVO...");
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
    } catch (error) {
      console.error("Error en el motor cronal:", error);
      setErrorMsg("Interferencia temporal: falló la transmisión de tu decisión.");
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
        comenzarNuevaNovela();
      }
    } catch (err) {
      console.error("Error eliminando bucle:", err);
    }
  };

  // Paleta diegética
  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'bajo': return '#10B981';
      case 'medio': return '#F59E0B';
      case 'critico': return '#EF4444';
      default: return '#666666';
    }
  };

  const getTempoColor = (tempo: SceneTempo) => {
    switch (tempo) {
      case 'frenetico': return '#EF4444';
      case 'tension_latente': return '#F59E0B';
      case 'calma_narrativa': return '#3B82F6';
      default: return '#777777';
    }
  };

  const getVirginiaColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'leal': return '#10B981';
      case 'neutral': return '#F59E0B';
      case 'tensa': return '#FB923C';
      case 'hostil': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ----------------- HUD SUPERIOR DIEGÉTICO ----------------- */}
      <View style={styles.hud}>
        <View style={styles.hudLeftGroup}>
          <Text style={[styles.hudLabel, salud <= 30 && styles.dangerText]}>
            SALUD {salud}%
          </Text>
          <Text style={styles.hudDivider}>|</Text>
          <Text style={[styles.hudLabel, entropia >= 50 && styles.warningText]}>
            ENTROPÍA {entropia}%
          </Text>
        </View>

        <View style={styles.hudRightGroup}>
          {/* Botón Dossier / Virginia */}
          <TouchableOpacity 
            style={[styles.hudPill, { borderColor: `${getVirginiaColor(virginia.status)}66` }]}
            onPress={() => setShowDossierModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.hudPillText, { color: getVirginiaColor(virginia.status) }]}>
              ⚔ VIRGINIA ({virginia.intensity}/10)
            </Text>
          </TouchableOpacity>

          {/* Botón Archivo de Trayectorias */}
          <TouchableOpacity 
            style={styles.hudPill}
            onPress={abrirModalBucles}
            activeOpacity={0.7}
          >
            <Text style={styles.hudPillText}>📜 TRAYECTORIAS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub-barra de tempo e indicador de rama activa */}
      <View style={styles.subHud}>
        <Text style={styles.subHudSession}>
          RAMA: {activeBranch.toUpperCase()}
        </Text>
        <View style={[styles.tempoBadge, { borderColor: `${getTempoColor(sceneTempo)}44` }]}>
          <Text style={[styles.tempoText, { color: getTempoColor(sceneTempo) }]}>
            ● {sceneTempo.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ----------------- LIENZO NARRATIVO TIPO LIBRO ----------------- */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.narrativeContainer}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Cabecera Literaria del Libro */}
        <View style={styles.bookHeader}>
          <Text style={styles.bookMainTitle}>ARQUÍMEDES</Text>
          <Text style={styles.bookSagaSubtitle}>LIBRO I: LA VOLUNTAD DE LAS CENIZAS</Text>
          <Text style={styles.actSubtitle}>◈ {actTitle.toUpperCase()} ◈</Text>
          <Text style={styles.chapterHeaderTitle}>{chapterTitle}</Text>
          <View style={styles.bookHeaderDivider} />
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

        {/* Ilustración de la Escena (FLUX) */}
        {imageUrl ? (
          <View style={styles.sceneIllustrationContainer}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.sceneIllustration}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
            <Text style={styles.sceneIllustrationCaption}>
              // VISOR DE ENTORNO //
            </Text>
          </View>
        ) : null}

        {/* Prosa Principal de la Novela */}
        <Text style={styles.prose}>
          {narrativa || (loading ? "Sintonizando los muros de la Academia Militar..." : "")}
        </Text>

        {/* ----------------- PANTALLA DE GAME OVER ----------------- */}
        {isGameOver ? (
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
        ) : (
          /* ----------------- DECISIONES O CONTINUACIÓN ----------------- */
          <View style={styles.optionsWrapper}>
            {loading && (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color="#888888" style={{ marginRight: 10 }} />
                <Text style={styles.loadingBannerText}>{loadingStatusText}</Text>
              </View>
            )}

            {/* CASO A: CONTINUACIÓN DE LECTURA (1 BOTÓN FLUIDO) */}
            {!isCrossroad && opciones.length <= 1 && (
              <TouchableOpacity 
                style={[styles.continueButton, loading && styles.optionButtonDisabled]}
                onPress={() => tomarDecision(opciones[0]?.label || "Continuar leyendo...")}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={styles.continueButtonInner}>
                  <Text style={styles.continueButtonText}>
                    {opciones[0]?.label || "CONTINUAR LEYENDO ❯"}
                  </Text>
                  <Text style={styles.continueButtonSubtext}>
                    Avanzar página narrativa • La trama se desenvuelve
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* CASO B: ENCRUCIJADA TÁCTICA (3 O 4 CARTAS DE DECISIÓN) */}
            {(isCrossroad || opciones.length > 1) && (
              <View style={styles.crossroadContainer}>
                <View style={styles.crossroadBanner}>
                  <Text style={styles.crossroadBadge}>⚡ PUNTO DE DIVERGENCIA CAUSAL</Text>
                  <Text style={styles.crossroadNotice}>
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
                        loading && styles.optionButtonDisabled
                      ]} 
                      onPress={() => tomarDecision(opcion.label)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionHeader}>
                        <Text style={styles.optionApproach}>
                          [{opcion.approach.toUpperCase()}]
                        </Text>
                        <View style={[styles.riskBadge, { borderColor: `${riskColor}55` }]}>
                          <Text style={[styles.riskText, { color: riskColor }]}>
                            {opcion.risk_level.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.optionText, loading && styles.optionTextMuted]}>
                        {opcion.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ----------------- MODAL: ARCHIVO DE TRAYECTORIAS / PARTIDAS ----------------- */}
      <Modal
        visible={showLoopsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLoopsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REGISTRO DE TRAYECTORIAS (ARQUÍMEDES)</Text>
              <TouchableOpacity onPress={() => setShowLoopsModal(false)}>
                <Text style={styles.modalCloseText}>[ CERRAR ✕ ]</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.newLoopButton}
              onPress={comenzarNuevaNovela}
              activeOpacity={0.8}
            >
              <Text style={styles.newLoopButtonText}>
                + COMENZAR NUEVA TRAYECTORIA DESDE EL INICIO CANÓNICO
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalSectionLabel}>TRAYECTORIAS REGISTRADAS EN LA BASE DE DATOS:</Text>

            {loadingGames ? (
              <ActivityIndicator size="small" color="#A0A09C" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={styles.modalScroll}>
                {savedGamesList.length === 0 ? (
                  <Text style={styles.emptyListText}>No hay trayectorias archivadas.</Text>
                ) : (
                  savedGamesList.map((game, index) => {
                    const esLaActual = game.session_id === sessionId;
                    return (
                      <View 
                        key={index} 
                        style={[styles.savedGameCard, esLaActual && styles.savedGameCardActive]}
                      >
                        <View style={styles.savedGameCardHeader}>
                          <Text style={styles.savedGameCardTitle}>
                            {game.chapter_title || game.session_id}
                          </Text>
                          {esLaActual && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>ACTUAL</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.savedGameCardSub}>
                          {game.act_title || "Acto I"} • Rama: {game.active_branch || "Cadete"} • Salud: {game.health ?? 100}%
                        </Text>
                        <Text style={styles.savedGameCardDate}>
                          ID: {game.session_id}
                        </Text>

                        <View style={styles.savedGameCardActions}>
                          <TouchableOpacity 
                            style={styles.loadGameButton}
                            onPress={() => reanudarPartida(game.session_id)}
                          >
                            <Text style={styles.loadGameButtonText}>
                              {esLaActual ? "[ CONTINUAR LEYENDO ]" : "[ CARGAR TRAYECTORIA ]"}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={styles.deleteGameButton}
                            onPress={() => eliminarBucle(game.session_id)}
                          >
                            <Text style={styles.deleteGameButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ----------------- MODAL: DOSSIER TÁCTICO & SISTEMA DE CONTINUIDAD ----------------- */}
      <Modal
        visible={showDossierModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDossierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>DOSSIER TÁCTICO & SISTEMA DE CONTINUIDAD</Text>
              <TouchableOpacity onPress={() => setShowDossierModal(false)}>
                <Text style={styles.modalCloseText}>[ CERRAR ✕ ]</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Botón Exportar Novela a EPUB */}
              <TouchableOpacity 
                style={styles.exportEpubButton} 
                onPress={() => Linking.openURL(`${API_URL}/api/game/${sessionId}/export/epub`)}
                activeOpacity={0.8}
              >
                <Text style={styles.exportEpubButtonText}>📥 EXPORTAR NOVELA A EPUB (APPLE BOOKS)</Text>
                <Text style={styles.exportEpubButtonSubtext}>Compila los capítulos de tu historia en un libro digital listo para leer</Text>
              </TouchableOpacity>

              {/* Indicador de Ruta Secreta Universal */}
              {secretRouteUnlocked && (
                <View style={styles.secretRouteBox}>
                  <Text style={styles.secretRouteTitle}>✦ BRECHA CÓSMICA: RUTA SECRETA ACTIVADA ✦</Text>
                  <Text style={styles.secretRouteDesc}>
                    Tus elecciones han conectado anomalías que desafían la cronología humana. Las Capas 3 y 4 están activas.
                  </Text>
                </View>
              )}

              {/* Sección Trayectoria Actual */}
              <View style={styles.dossierSection}>
                <Text style={styles.dossierSectionTitle}>// TRAYECTORIA DE OSCAR</Text>
                <View style={styles.branchBadge}>
                  <Text style={styles.branchBadgeText}>{activeBranch.toUpperCase()}</Text>
                </View>
                <Text style={styles.branchDescription}>
                  Las decisiones de Oscar en la Academia determinan si se acerca a Ares, se rebela contra las instituciones o forja un destino propio.
                </Text>
              </View>

              {/* Sección Virginia */}
              <View style={styles.dossierSection}>
                <Text style={styles.dossierSectionTitle}>// VIRGINIA (CADETE / AGENCIA PROPIA)</Text>
                <View style={styles.dossierStatusRow}>
                  <Text style={styles.dossierFieldLabel}>AFINIDAD / CONFIANZA:</Text>
                  <Text style={[styles.dossierFieldValue, { color: getVirginiaColor(virginia.status) }]}>
                    {virginia.status.toUpperCase()} ({virginia.intensity}/10)
                  </Text>
                </View>
                <View style={styles.intensityBarTrack}>
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
                <View style={styles.agendaBox}>
                  <Text style={styles.agendaLabel}>OBJETIVO PROPIO DE VIRGINIA:</Text>
                  <Text style={styles.agendaText}>
                    "{virginia.current_agenda || 'Sobrevivir a la prueba de admisión de la Academia'}"
                  </Text>
                </View>
                <Text style={styles.dossierNotes}>
                  "{virginia.notes || 'Compañera de ingreso a la Academia. Sus convicciones y elecciones forman parte de la causalidad del mundo.'}"
                </Text>
              </View>

              {/* Sección Hechos Confirmados (Continuidad) */}
              <View style={styles.dossierSection}>
                <Text style={styles.dossierSectionTitle}>// HECHOS CONFIRMADOS (CANON ESTABLECIDO)</Text>
                {confirmedFacts.length === 0 ? (
                  <Text style={styles.dossierEmpty}>
                    - Oscar ha ingresado como cadete ordinario en la Academia Militar para enfrentar a Ares.
                  </Text>
                ) : (
                  confirmedFacts.map((fact, idx) => (
                    <View key={idx} style={styles.dossierItemRow}>
                      <Text style={styles.dossierFactBullet}>✔</Text>
                      <Text style={styles.dossierFactText}>{fact}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Sección Posibilidades Abiertas (Continuidad) */}
              <View style={styles.dossierSection}>
                <Text style={styles.dossierSectionTitle}>// POSIBILIDADES ABIERTAS / INCÓGNITAS</Text>
                {openThreads.length === 0 ? (
                  <Text style={styles.dossierEmpty}>
                    - ¿Qué verdades oculta la historia oficial de la Academia y la guerra contra Ares?
                  </Text>
                ) : (
                  openThreads.map((thread, idx) => (
                    <View key={idx} style={styles.dossierItemRow}>
                      <Text style={styles.dossierThreadBullet}>?</Text>
                      <Text style={styles.dossierThreadText}>{thread}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Sección Inventario */}
              <View style={styles.dossierSection}>
                <Text style={styles.dossierSectionTitle}>// EQUIPO & OBJETOS TÁCTICOS</Text>
                {inventory.length === 0 ? (
                  <Text style={styles.dossierEmpty}>Suministros reglamentarios de cadete.</Text>
                ) : (
                  inventory.map((item, idx) => (
                    <View key={idx} style={styles.dossierItemRow}>
                      <Text style={styles.dossierItemBullet}>◈</Text>
                      <Text style={styles.dossierItemText}>{item}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Sección Lore Ledger (Grandes Verdades) */}
              <View style={styles.dossierSection}>
                <Text style={styles.dossierSectionTitle}>// GRANDES REVELACIONES DESCUBIERTAS</Text>
                {loreLedger.length === 0 ? (
                  <Text style={styles.dossierEmpty}>
                    Aún no se han descubierto secretos inmutables en este ciclo.
                  </Text>
                ) : (
                  loreLedger.map((milestone, idx) => (
                    <View key={idx} style={styles.dossierItemRow}>
                      <Text style={styles.dossierMilestoneBullet}>★</Text>
                      <Text style={styles.dossierMilestoneText}>{milestone}</Text>
                    </View>
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#050505', // Negro OLED puro
    paddingTop: 50,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  hudLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hudDivider: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#262626',
    fontSize: 12,
    marginHorizontal: 10,
  },
  hudLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#777777',
    fontSize: 11,
    letterSpacing: 1,
  },
  hudPill: {
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
  },
  hudPillText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    color: '#A0A09C',
    fontWeight: '600',
  },
  subHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: '#080808',
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  subHudSession: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#888888',
    fontSize: 10,
    letterSpacing: 1,
  },
  tempoBadge: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 2,
  },
  tempoText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  dangerText: {
    color: '#EF4444',
  },
  warningText: {
    color: '#F59E0B',
  },
  narrativeContainer: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 24,
  },
  bookHeader: {
    marginBottom: 28,
    alignItems: 'center',
  },
  bookMainTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#555555',
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: 4,
  },
  bookSagaSubtitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#3B82F6',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  actSubtitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#B45309', // Muted amber
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
  },
  chapterHeaderTitle: {
    fontFamily: 'Merriweather_700Bold',
    color: '#F3F4F6',
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 14,
  },
  bookHeaderDivider: {
    width: 60,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  sceneIllustrationContainer: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1F1F1F',
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  sceneIllustration: {
    width: '100%',
    height: 220,
    backgroundColor: '#0A0A0A',
  },
  sceneIllustrationCaption: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#555555',
    fontSize: 9,
    letterSpacing: 1.5,
    padding: 8,
    textAlign: 'right',
  },
  prose: {
    fontFamily: 'Merriweather_400Regular',
    color: '#D4D4D0',
    fontSize: 18,
    lineHeight: 33,
    letterSpacing: 0.2,
  },
  optionsWrapper: {
    marginTop: 44,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#0A0A0A',
  },
  loadingBannerText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  continueButton: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#0B132B',
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueButtonInner: {
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#60A5FA',
    fontSize: 14,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  continueButtonSubtext: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#3B82F6',
    fontSize: 10,
    opacity: 0.7,
  },
  crossroadContainer: {
    gap: 14,
  },
  crossroadBanner: {
    borderWidth: 1,
    borderColor: '#B45309',
    backgroundColor: '#1C1205',
    padding: 14,
    marginBottom: 4,
  },
  crossroadBadge: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#F59E0B',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  crossroadNotice: {
    fontFamily: 'Merriweather_400Regular',
    color: '#D97706',
    fontSize: 12,
    lineHeight: 18,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#262626',
    padding: 18,
    backgroundColor: '#0A0A0A',
  },
  optionButtonDisabled: {
    opacity: 0.45,
    borderColor: '#181818',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionApproach: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#555555',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  riskBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  riskText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '600',
  },
  optionText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#A0A09C',
    fontSize: 13,
    lineHeight: 21,
  },
  optionTextMuted: {
    color: '#555555',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#1A0808',
    padding: 18,
    marginBottom: 24,
  },
  errorText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  retryButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#EF4444',
    fontSize: 11,
  },
  gameOverContainer: {
    marginTop: 48,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#0F0404',
    padding: 24,
  },
  gameOverTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#EF4444',
    fontSize: 13,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  gameOverReason: {
    fontFamily: 'Merriweather_400Regular',
    color: '#E5E5E5',
    fontSize: 16,
    lineHeight: 28,
    marginBottom: 24,
  },
  restartButton: {
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#1E0808',
    alignItems: 'center',
  },
  restartButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#F87171',
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  // ESTILOS DE MODALES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '85%',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#262626',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 14,
  },
  modalTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#E5E5E5',
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  modalCloseText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#EF4444',
    fontSize: 11,
  },
  modalScroll: {
    marginTop: 10,
  },
  newLoopButton: {
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: '#062817',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  newLoopButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#34D399',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  modalSectionLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#666666',
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  emptyListText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
  },
  savedGameCard: {
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#0E0E0E',
    padding: 16,
    marginBottom: 12,
  },
  savedGameCardActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#0A1224',
  },
  savedGameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  savedGameCardTitle: {
    fontFamily: 'Merriweather_700Bold',
    color: '#E5E5E5',
    fontSize: 14,
    flex: 1,
  },
  currentBadge: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  currentBadgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: '700',
  },
  savedGameCardSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#888888',
    fontSize: 10,
    marginBottom: 4,
  },
  savedGameCardDate: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#555555',
    fontSize: 9,
    marginBottom: 12,
  },
  savedGameCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  loadGameButton: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  loadGameButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#60A5FA',
    fontSize: 10,
    letterSpacing: 1,
  },
  deleteGameButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  deleteGameButtonText: {
    color: '#EF4444',
    fontSize: 12,
  },
  // DOSSIER
  exportEpubButton: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  exportEpubButtonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  exportEpubButtonSubtext: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#94A3B8',
    fontSize: 10,
    textAlign: 'center',
  },
  secretRouteBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  secretRouteTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  secretRouteDesc: {
    fontFamily: 'Merriweather_400Regular',
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
  dossierSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 18,
  },
  dossierSectionTitle: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#D97706',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
    fontWeight: '700',
  },
  branchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  branchBadgeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  branchDescription: {
    fontFamily: 'Merriweather_400Regular',
    color: '#888888',
    fontSize: 12,
    lineHeight: 18,
  },
  dossierStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dossierFieldLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#777777',
    fontSize: 11,
  },
  dossierFieldValue: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    fontWeight: '700',
  },
  intensityBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#1E1E1E',
    marginBottom: 10,
  },
  intensityBarFill: {
    height: 4,
  },
  agendaBox: {
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#0E0E0E',
    padding: 10,
    marginBottom: 10,
  },
  agendaLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#F59E0B',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  agendaText: {
    fontFamily: 'Merriweather_400Regular',
    color: '#D4D4D0',
    fontSize: 12,
    fontStyle: 'italic',
  },
  dossierNotes: {
    fontFamily: 'Merriweather_400Regular',
    color: '#A0A09C',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  dossierEmpty: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#555555',
    fontSize: 11,
    lineHeight: 18,
  },
  dossierItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dossierFactBullet: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#10B981',
    fontSize: 12,
    marginRight: 8,
    marginTop: 2,
  },
  dossierFactText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#E5E5E5',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  dossierThreadBullet: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#3B82F6',
    fontSize: 12,
    marginRight: 8,
    marginTop: 2,
  },
  dossierThreadText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#93C5FD',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  dossierItemBullet: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#888888',
    fontSize: 10,
    marginRight: 8,
    marginTop: 2,
  },
  dossierItemText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#D4D4D0',
    fontSize: 12,
  },
  dossierMilestoneBullet: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#F59E0B',
    fontSize: 11,
    marginRight: 8,
    marginTop: 2,
  },
  dossierMilestoneText: {
    fontFamily: 'Merriweather_400Regular',
    color: '#E5E5E5',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
});
