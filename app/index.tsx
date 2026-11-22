import { OwnerTabBar, type OwnerTab } from '@/components/dashboards/owner-tab-bar';
import { ServiceCategoryFilters, matchesServiceCategory, type ServiceCategory } from '@/components/service-category-filters';
import { StaffSchedulePanel } from '@/components/staff-schedule-panel';
import { BookingStatusFilters, type BookingFilter } from '@/components/booking-status-filters';
import { BookingActions } from '@/components/booking-actions';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL as FACEFIT_API_URL } from "@/services/api-config";
import { FaceScanScreen } from "@/components/face-scan-screen";
import { FaceLandmarkOverlay } from "@/components/face-landmark-overlay";
import hairstyleCatalog from "@/constants/hairstyle-catalog.json";
import { CustomerDashboardScreen } from "@/components/dashboards/customer-dashboard-screen";
import { OwnerDashboardScreen } from "@/components/dashboards/owner-dashboard-screen";
import { StylistDashboardScreen } from "@/components/dashboards/stylist-dashboard-screen";
import { rankStylists } from "@/services/stylist-matching";
import { HairstyleStylists } from "@/components/hairstyle-stylists";
import { OwnerSalonSetupScreen } from "@/components/dashboards/owner-salon-setup-screen";
import { LocationMap, type MapCoordinate } from "@/components/location-map";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { CustomerSettingsScreen } from "@/components/profile/customer-settings-screen";
import { SalonMap } from "@/components/salon-map";
import { SalonLocationPicker } from "@/components/salon-location-picker";
import {
  createBooking,
  createOwnerPortfolioImage,
  createOwnerReviewReply,
  createOwnerSalon,
  createOwnerService,
  createOwnerStaff,
  createSalonReview,
  getAccountItems,
  getApiAssetUrl,
  getBookings,
  getFavoriteSalons,
  getMySalonReviews,
  getOwnerDashboard,
  getOwnerManagement,
  getProfile,
  getSalonPortfolio,
  getSalonReviews,
  getSalons,
  getSalonServices,
  getSalonStaff,
  getUnreadNotificationCount,
  login as loginUser,
  markNotificationRead,
  removeOwnerPortfolioImage,
  removeOwnerReviewReply,
  reviewStylist,
  removeOwnerService,
  removeOwnerStaff,
  saveHairstyle,
  setFavoriteSalon,
  signup as signupUser,
  updateOwnerBooking,
  updateOwnerProfile,
  updateOwnerService,
  updateOwnerStaff,
  updateSalonReview,
  type AccountItem,
  type AuthUser,
  type Booking,
  type OwnerDashboard,
  type OwnerManagement,
  type PortfolioImage,
  type Salon,
  type SalonReview,
  type SalonReviewSummary,
  type SalonService,
  type SalonStaff,
  type UserProfile,
  analyzeHairAndScalp,
  requestHairstyleSuggestions,
  updateProfile,
  type FaceAnalysis,
  type HairScalpAnalysis,
} from "@/services/api";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isSalonOpenNow, isSalonSlotAvailable, salonStatusText } from "@/services/salon-hours";

type Screen =
  | "splash"
  | "onboarding"
  | "login"
  | "signup"
  | "consent"
  | "home"
  | "scan"
  | "processing"
  | "result"
  | "recommendations"
  | "style-detail"
  | "salons"
  | "salon-detail"
  | "service"
  | "stylist"
  | "datetime"
  | "summary"
  | "success"
  | "bookings"
  | "profile"
  | "saved"
  | "saved-style-detail"
  | "saved-salons"
  | "notifications"
  | "reviews"
  | "settings"
  | "stylist-dashboard"
  | "stylist-appointments"
  | "stylist-detail"
  | "stylist-status"
  | "stylist-notifications"
  | "owner-dashboard"
  | "owner-bookings"
  | "owner-services"
  | "owner-staff"
  | "owner-profile"
  | "owner-reviews"
  | "owner-notifications";

type OwnerEditor =
  | {
      kind: "service";
      id?: number;
      name: string;
      description: string;
      price: string;
      durationMinutes: string;
      isActive: boolean;
    }
  | {
      kind: "staff";
      id?: number;
      name: string;
      email: string;
      phone: string;
      specialties: string;
      password: string;
      isAvailable: boolean;
      imageUri: string | null;
      imageData?: string | null;
    }
  | {
      kind: "profile";
      name: string;
      description: string;
      address: string;
      city: string;
      phone: string;
      website: string;
      openingTime: string;
      closingTime: string;
      imageUri: string | null;
      imageData?: string | null;
    }
  | {
      kind: "reply";
      reviewId: number;
      reviewerName: string;
      message: string;
      imageUri: string | null;
      imageData?: string | null;
    };

type ConfirmationPromptData = {
  eyebrow: string;
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  showIcon?: boolean;
  showEyebrow?: boolean;
  centerTitle?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

async function chooseImage(context: string, allowsEditing = true) {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        `Allow hAIrfit to choose a photo for ${context}.`,
      );
      return null;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing,
    quality: 0.65,
    base64: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.base64 || asset.base64.length * 0.75 > 2.5 * 1024 * 1024) {
    Alert.alert(
      "Photo could not be used",
      "Choose a JPG, PNG, or WebP photo smaller than 2.5 MB.",
    );
    return null;
  }
  // Expo ImagePicker's base64 field contains JPEG bytes; the original asset
  // MIME type can describe a different source format such as HEIC.
  return { uri: asset.uri, data: `data:image/jpeg;base64,${asset.base64}` };
}

const C = {
  rose: "#4A765A",
  roseDark: "#355C45",
  blush: "#EDF5EE",
  pale: "#FAFBF8",
  ink: "#29332D",
  muted: "#66736B",
  line: "#E2E9E2",
  white: "#FFFFFF",
  green: "#4A765A",
  gold: "#6F946E",
};
// Bump this version when the consent terms materially change.
const CONSENT_VERSION = 1;
const consentStorageKey = (userId: number) => `facefit:consent:${userId}`;
const AUTH_SESSION_STORAGE_KEY = "facefit:auth-session";
const HAIRSTYLE_WORDS = new Set("hair hairstyle haircut cut style styles fringe bang bangs bob pixie fade taper tapered layer layers layered curly curl curls wavy wave waves straight textured texture length short long medium undercut quiff crop braid braids ponytail bun shag mullet crew afro locs dreadlocks part volume low high mid skin side swept side-swept classic modern clean neat trim natural simple messy maintenance low-maintenance wolf butterfly curtain french caesar pompadour slicked back slicked-back mohawk faux hawk faux-hawk buzz crewcut crew-cut blowout shoulder shoulder-length chin chin-length mid-length blunt wispy asymmetrical black brown blonde gray red face shape round oval square heart diamond oblong".toLowerCase().split(/\s+/));
const HAIRSTYLE_DESCRIPTORS = new Set("professional elegant edgy bold soft casual formal trendy stylish flattering suitable easy effortless low-maintenance lightweight thick thin fine dense natural youthful mature polished feminine masculine versatile office wedding daily everyday messy neat sharp subtle dramatic voluminous face facial features".split(/\s+/));
const PROMPT_CONNECTORS = new Set("a an the with for me i want would like prefer need get looking look try please can you suggest recommend give show find that suits my keep it to and or but very more less of in on will without while as something make makes work good".split(/\s+/));
function isValidHairstylePrompt(value: string) {
  if (value.trim().length > 300 || !/^[a-z\s'.,!?-]+$/i.test(value.trim())) return false;
  const words = value.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) || [];
  const relevantWordCount = words.filter((word) => HAIRSTYLE_WORDS.has(word) || HAIRSTYLE_DESCRIPTORS.has(word)).length;
  const unknownWordCount = words.filter((word) => !HAIRSTYLE_WORDS.has(word) && !HAIRSTYLE_DESCRIPTORS.has(word) && !PROMPT_CONNECTORS.has(word)).length;
  const unknownWordLimit = Math.max(1, Math.floor(words.length * 0.25));
  return words.length >= 2 && relevantWordCount >= 2 && unknownWordCount <= unknownWordLimit;
}
const artwork = require("../assets/images/facefit-styles.png");
const faceFitLogo = require("../assets/images/facefit-logo-green.png");
const salonListingCover = require("../assets/images/salon-cover.png");
const shapeCopy: Record<
  FaceAnalysis["faceShape"],
  { title: string; description: string }
> = {
  oval: {
    title: "Balanced & versatile",
    description:
      "Your face is slightly longer than it is wide, with a softly tapered jaw.",
  },
  round: {
    title: "Soft & proportionate",
    description:
      "Your face length and width are similar, with a gently curved jawline.",
  },
  square: {
    title: "Defined & structured",
    description:
      "Your forehead, cheekbones, and jaw have similar widths with a defined jawline.",
  },
  heart: {
    title: "Broad & tapered",
    description:
      "Your forehead is wider while the lower face narrows toward the chin.",
  },
  oblong: {
    title: "Long & elegant",
    description:
      "Your face is noticeably longer than it is wide with relatively even side proportions.",
  },
  diamond: {
    title: "Angular & sculpted",
    description:
      "Your cheekbones are the widest point, with a narrower forehead and jaw.",
  },
};

function Button({
  label,
  onPress,
  secondary = false,
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.buttonSecondary,
        disabled && s.buttonDisabled,
        pressed && s.pressed,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={19} color={secondary ? C.rose : C.white} />
      )}
      <Text style={[s.buttonText, secondary && s.buttonTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FavoriteIcon({
  active,
  busy = false,
  size = 21,
}: {
  active: boolean;
  busy?: boolean;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: active ? 1.28 : 0.86,
        speed: 30,
        bounciness: 7,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 24,
        bounciness: 6,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [active, scale]);

  return (
    <Animated.View style={{ opacity: busy ? 0.62 : 1, transform: [{ scale }] }}>
      <Ionicons
        name={active ? "heart" : "heart-outline"}
        size={size}
        color={C.rose}
      />
    </Animated.View>
  );
}


function FavoriteToast({
  toast,
  onDismiss,
}: {
  toast: { message: string; success: boolean } | null;
  onDismiss: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    if (!toast) return;
    const useNativeDriver = Platform.OS !== "web";
    opacity.setValue(0);
    translateY.setValue(18);
    scale.setValue(0.97);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver }),
      Animated.spring(translateY, {
        toValue: 0,
        speed: 22,
        bounciness: 4,
        useNativeDriver,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 22,
        bounciness: 3,
        useNativeDriver,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 220,
          useNativeDriver,
        }),
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 220,
          useNativeDriver,
        }),
      ]).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, 2300);

    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
      translateY.stopAnimation();
      scale.stopAnimation();
    };
  }, [onDismiss, opacity, scale, toast, translateY]);

  if (!toast) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        s.favoriteToast,
        { pointerEvents: "none" },
        !toast.success && s.favoriteToastError,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <View style={s.favoriteToastIcon}>
        <Ionicons
          name={toast.success ? "sparkles" : "alert-circle"}
          size={22}
          color={C.white}
        />
      </View>
      <Text style={s.favoriteToastText}>{toast.message}</Text>
    </Animated.View>
  );
}

function NotificationBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <View style={s.notificationBadge}>
      <Text style={s.notificationBadgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

function Header({
  title,
  onBack,
  action,
  onAction,
  actionColor = C.ink,
  favoriteActive,
  actionBusy = false,
  actionBadge = 0,
}: {
  title: string;
  onBack?: () => void;
  action?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  actionColor?: string;
  favoriteActive?: boolean;
  actionBusy?: boolean;
  actionBadge?: number;
}) {
  return (
    <View style={s.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={s.iconButton}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </Pressable>
      ) : (
        <View style={s.logoSmall}>
          <Image
            accessibilityLabel="hAIrfit logo"
            source={faceFitLogo}
            resizeMode="contain"
            style={s.logoImageSmall}
          />
        </View>
      )}
      <Text style={s.headerTitle}>{title}</Text>
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: favoriteActive, busy: actionBusy }}
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [
            s.iconButton,
            favoriteActive && s.favoriteButtonActive,
            pressed && s.favoritePressed,
          ]}
        >
          {favoriteActive === undefined ? (
            action && <Ionicons name={action} size={21} color={actionColor} />
          ) : (
            <FavoriteIcon active={favoriteActive} busy={actionBusy} />
          )}
          <NotificationBadge count={actionBadge} />
        </Pressable>
      ) : (
        <View style={s.iconButton}>
          {action && <Ionicons name={action} size={21} color={actionColor} />}
          <NotificationBadge count={actionBadge} />
        </View>
      )}
    </View>
  );
}

function ConfirmationPrompt({
  prompt,
  onDismiss,
}: {
  prompt: ConfirmationPromptData | null;
  onDismiss: () => void;
}) {
  if (!prompt) return null;
  const confirm = () => {
    onDismiss();
    prompt.onConfirm();
  };
  const cancel = () => {
    onDismiss();
    prompt.onCancel?.();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <Pressable style={s.promptBackdrop} onPress={onDismiss}>
        <Pressable style={s.promptSheet} onPress={() => {}}>
          {prompt.showIcon !== false && (
            <View style={s.promptIcon}>
              <Ionicons name={prompt.icon} size={24} color={C.rose} />
            </View>
          )}
          {prompt.showEyebrow !== false && (
            <Text style={s.promptEyebrow}>{prompt.eyebrow}</Text>
          )}
          <Text style={[s.promptTitle, prompt.centerTitle && s.promptTitleCentered]}>
            {prompt.title}
          </Text>
          <Text style={s.promptMessage}>{prompt.message}</Text>
          <View style={s.promptActions}>
            <Pressable
              accessibilityRole="button"
              onPress={cancel}
              style={({ pressed }) => [s.promptCancel, pressed && s.pressed]}
            >
              <Text style={s.promptCancelText}>{prompt.cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={confirm}
              style={({ pressed }) => [s.promptConfirm, pressed && s.pressed]}
            >
              <Text style={s.promptConfirmText}>{prompt.confirmLabel}</Text>
              <Ionicons name="arrow-forward" size={16} color={C.white} />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SectionTitle({
  title,
  action,
  onAction,
  actionLoading = false,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action &&
        (onAction ? (
          <Pressable
            accessibilityRole="button"
            disabled={actionLoading}
            onPress={onAction}
            style={({ pressed }) => [s.sectionAction, pressed && s.pressed]}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.rose} />
            ) : (
              <>
                <Text style={s.link}>{action}</Text>
                <Ionicons name="map-outline" size={17} color={C.rose} />
              </>
            )}
          </Pressable>
        ) : (
          <Text style={s.link}>{action}</Text>
        ))}
    </View>
  );
}

function Art({
  height = 160,
  quadrant,
}: {
  height?: number;
  quadrant?: number;
}) {
  if (quadrant === undefined)
    return <Image source={artwork} style={[s.art, { height }]} />;
  return (
    <View style={[s.artCrop, { height }]}>
      <Image
        source={artwork}
        style={[
          s.artSheet,
          quadrant === 1 && s.q1,
          quadrant === 2 && s.q2,
          quadrant === 3 && s.q3,
        ]}
      />
    </View>
  );
}

function Field({
  placeholder,
  secure,
  icon,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  placeholder: string;
  secure?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  const [showSecret, setShowSecret] = useState(false);
  return (
    <View style={s.field}>
      <Ionicons name={icon} size={19} color={C.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4A765A"
        secureTextEntry={secure && !showSecret}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={s.input}
      />
      {secure && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showSecret ? "Hide password" : "Show password"}
          hitSlop={10}
          onPress={() => setShowSecret((visible) => !visible)}
        >
          <Ionicons
            name={showSecret ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={C.muted}
          />
        </Pressable>
      )}
    </View>
  );
}

function SalonLogo({
  name,
  large = false,
  imageUrl,
}: {
  name: string;
  large?: boolean;
  imageUrl?: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  if (imageUrl)
    return (
      <Image
        source={{ uri: getApiAssetUrl(imageUrl)! }}
        style={[s.salonLogo, s.salonLogoImage, large && s.salonLogoLarge]}
      />
    );
  return (
    <View style={[s.salonLogo, large && s.salonLogoLarge]}>
      <Ionicons name="storefront" size={large ? 34 : 19} color={C.white} />
      <Text style={[s.salonLogoText, large && s.salonLogoTextLarge]}>
        {initials}
      </Text>
    </View>
  );
}

function TabBar({ screen, go }: { screen: Screen; go: (x: Screen) => void }) {
  const tabs: {
    key: Screen;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "salons", label: "Salons", icon: "storefront-outline" },
    { key: "scan", label: "Scan", icon: "scan-outline" },
    { key: "bookings", label: "Bookings", icon: "calendar-outline" },
    { key: "profile", label: "Profile", icon: "person-outline" },
  ];
  return (
    <View style={[s.tabBar, Platform.OS === "web" && s.tabBarWeb]}>
      {tabs.map((t) => {
        const active =
          screen === t.key ||
          (t.key === "scan" &&
            [
              "processing",
              "result",
              "recommendations",
              "style-detail",
            ].includes(screen)) ||
          (t.key === "profile" && screen === "settings");
        return (
          <Pressable key={t.key} accessibilityRole="button" accessibilityLabel={t.key === 'scan' ? 'AI face scan' : t.label} onPress={() => go(t.key)} style={[s.tabItem, t.key === 'scan' && s.scanTabItem]}>
            {t.key === 'scan' ? <View style={[s.scanTabButton, active && s.scanTabButtonActive]}><Ionicons name="sparkles" size={12} color="#E4F1E3" style={s.scanSparkleOne}/><Ionicons name={active ? 'scan' : 'scan-outline'} size={27} color={C.white}/><Ionicons name="sparkles" size={10} color="#E4F1E3" style={s.scanSparkleTwo}/></View> : <Ionicons name={active ? (t.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap) : t.icon} size={22} color={active ? C.rose : C.muted}/>}
            <Text style={[s.tabLabel, active && s.tabActive, t.key === 'scan' && s.scanTabLabel]}>{t.key === 'scan' ? 'AI Scan' : t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenFrame({
  children,
  scroll = true,
  stickyHeader = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  stickyHeader?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const isTabletWeb = Platform.OS === "web" && width >= 600 && width < 900;
  return (
    <View
      style={[
        s.webShell,
        isWeb && s.webShellWeb,
        isDesktopWeb && s.webShellDesktop,
      ]}
    >
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[
              s.scroll,
              isTabletWeb && s.scrollTablet,
              isDesktopWeb && s.scrollDesktop,
              isDesktopWeb && { paddingHorizontal: width >= 1440 ? 64 : 40 },
            ]}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={stickyHeader ? [0] : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </SafeAreaView>
    </View>
  );
}

function OwnerEditorField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?:
    | "default"
    | "email-address"
    | "phone-pad"
    | "numeric"
    | "decimal-pad"
    | "url";
  multiline?: boolean;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={s.ownerEditorFieldWrap}>
      <Text style={s.ownerEditorLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4A765A"
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={
          keyboardType === "email-address" || keyboardType === "url"
            ? "none"
            : "sentences"
        }
        style={[s.ownerEditorInput, multiline && s.ownerEditorTextarea]}
      />
    </View>
  );
}

function OwnerEditorModal({
  editor,
  setEditor,
  saving,
  error,
  onSave,
}: {
  editor: OwnerEditor | null;
  setEditor: React.Dispatch<React.SetStateAction<OwnerEditor | null>>;
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  if (!editor) return null;
  const patchEditor = (patch: object) =>
    setEditor((current) =>
      current ? ({ ...current, ...patch } as OwnerEditor) : current,
    );
  const title =
    editor.kind === "service"
      ? `${editor.id ? "Edit" : "Add"} service`
      : editor.kind === "staff"
        ? `${editor.id ? "Edit" : "Add"} staff member`
        : editor.kind === "profile"
          ? "Edit business portfolio"
          : `Reply to ${editor.reviewerName}`;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => { if (!saving) setEditor(null); }}
    >
      <SafeAreaView style={s.ownerEditorSafe}>
        <KeyboardAvoidingView
          style={s.ownerEditorSafe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.ownerEditorHeader}>
            <View>
              <Text style={s.ownerEditorKicker}>SALON MANAGEMENT</Text>
              <Text style={s.ownerEditorTitle}>{title}</Text>
            </View>
            <Pressable
              disabled={saving}
              onPress={() => setEditor(null)}
              style={s.iconButton}
            >
              <Ionicons name="close" size={22} color={C.ink} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.ownerEditorScroll}
            keyboardShouldPersistTaps="handled"
          >
            {editor.kind === "service" && (
              <>
                <OwnerEditorField
                  label="Service name"
                  value={editor.name}
                  onChangeText={(name) => patchEditor({ name })}
                  placeholder="e.g. Layered haircut"
                />
                <OwnerEditorField
                  label="Description"
                  value={editor.description}
                  onChangeText={(description) => patchEditor({ description })}
                  placeholder="Describe what is included"
                  multiline
                />
                <View style={s.ownerEditorRow}>
                  <View style={s.ownerEditorHalf}>
                    <OwnerEditorField
                      label="Price (₱)"
                      value={editor.price}
                      onChangeText={(price) => patchEditor({ price })}
                      placeholder="350"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={s.ownerEditorHalf}>
                    <OwnerEditorField
                      label="Duration (minutes)"
                      value={editor.durationMinutes}
                      onChangeText={(durationMinutes) =>
                        patchEditor({ durationMinutes })
                      }
                      placeholder="60"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => patchEditor({ isActive: !editor.isActive })}
                  style={s.ownerToggleRow}
                >
                  <View>
                    <Text style={s.cardTitle}>Visible to customers</Text>
                    <Text style={s.small}>
                      Customers can book this service when enabled.
                    </Text>
                  </View>
                  <Ionicons
                    name={editor.isActive ? "toggle" : "toggle-outline"}
                    size={38}
                    color={editor.isActive ? C.rose : C.muted}
                  />
                </Pressable>
              </>
            )}
            {editor.kind === "staff" && (
              <>
                {editor.imageUri ? (
                  <View style={s.ownerEditorPhotoPreview}>
                    <Image
                      source={{ uri: editor.imageUri }}
                      style={s.ownerEditorPhoto}
                    />
                    <Pressable
                      onPress={() =>
                        patchEditor({ imageUri: null, imageData: null })
                      }
                      style={s.ownerEditorPhotoRemove}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={17}
                        color={C.white}
                      />
                      <Text style={s.reviewPhotoRemoveText}>Remove photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      void chooseImage("the staff profile").then(
                        (photo) =>
                          photo &&
                          patchEditor({
                            imageUri: photo.uri,
                            imageData: photo.data,
                          }),
                      )
                    }
                    style={s.ownerEditorPhotoPicker}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={32}
                      color={C.rose}
                    />
                    <View style={s.salonCardGrow}>
                      <Text style={s.cardTitle}>Add profile photo</Text>
                      <Text style={s.small}>
                        Shown to customers choosing a stylist
                      </Text>
                    </View>
                    <Ionicons name="camera-outline" size={22} color={C.rose} />
                  </Pressable>
                )}
                <OwnerEditorField
                  label="Full name"
                  value={editor.name}
                  onChangeText={(name) => patchEditor({ name })}
                  placeholder="Staff member name"
                />
                <OwnerEditorField
                  label="Email address"
                  value={editor.email}
                  onChangeText={(email) => patchEditor({ email })}
                  placeholder="stylist@example.com"
                  keyboardType="email-address"
                />
                <OwnerEditorField
                  label="Phone"
                  value={editor.phone}
                  onChangeText={(phone) => patchEditor({ phone })}
                  placeholder="09XX XXX XXXX"
                  keyboardType="phone-pad"
                />
                <OwnerEditorField
                  label="Specialties"
                  value={editor.specialties}
                  onChangeText={(specialties) => patchEditor({ specialties })}
                  placeholder="Hair color, styling, treatments"
                  multiline
                />
                <OwnerEditorField
                  label={
                    editor.id ? "New password (optional)" : "Temporary password"
                  }
                  value={editor.password}
                  onChangeText={(password) => patchEditor({ password })}
                  placeholder={
                    editor.id
                      ? "Leave blank to keep current password"
                      : "At least 8 characters"
                  }
                  secureTextEntry
                />
                <Pressable
                  onPress={() =>
                    patchEditor({ isAvailable: !editor.isAvailable })
                  }
                  style={s.ownerToggleRow}
                >
                  <View>
                    <Text style={s.cardTitle}>Available for bookings</Text>
                    <Text style={s.small}>
                      Show this team member to customers.
                    </Text>
                  </View>
                  <Ionicons
                    name={editor.isAvailable ? "toggle" : "toggle-outline"}
                    size={38}
                    color={editor.isAvailable ? C.rose : C.muted}
                  />
                </Pressable>
              </>
            )}
            {editor.kind === "profile" && (
              <>
                {editor.imageUri ? (
                  <View style={s.ownerSalonPhotoPreview}>
                    <Image
                      source={{ uri: editor.imageUri }}
                      style={s.ownerSalonPhoto}
                    />
                    <View style={s.ownerSalonPhotoActions}>
                      <Pressable
                        onPress={() =>
                          void chooseImage("the salon profile").then(
                            (photo) =>
                              photo &&
                              patchEditor({
                                imageUri: photo.uri,
                                imageData: photo.data,
                              }),
                          )
                        }
                        style={s.ownerPhotoAction}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={17}
                          color={C.white}
                        />
                        <Text style={s.reviewPhotoRemoveText}>Replace</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          patchEditor({ imageUri: null, imageData: null })
                        }
                        style={[s.ownerPhotoAction, s.ownerPhotoRemoveAction]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color={C.white}
                        />
                        <Text style={s.reviewPhotoRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      void chooseImage("the salon profile").then(
                        (photo) =>
                          photo &&
                          patchEditor({
                            imageUri: photo.uri,
                            imageData: photo.data,
                          }),
                      )
                    }
                    style={s.ownerSalonPhotoPicker}
                  >
                    <View style={s.ownerSalonPhotoPlaceholder}>
                      <Ionicons
                        name="storefront-outline"
                        size={36}
                        color={C.rose}
                      />
                    </View>
                    <View style={s.salonCardGrow}>
                      <Text style={s.cardTitle}>Add salon profile picture</Text>
                      <Text style={s.small}>
                        This will be the main photo customers see.
                      </Text>
                    </View>
                    <Ionicons name="camera-outline" size={23} color={C.rose} />
                  </Pressable>
                )}
                <OwnerEditorField
                  label="Business name"
                  value={editor.name}
                  onChangeText={(name) => patchEditor({ name })}
                />
                <OwnerEditorField
                  label="About your salon"
                  value={editor.description}
                  onChangeText={(description) => patchEditor({ description })}
                  placeholder="Tell customers about your salon and expertise"
                  multiline
                />
                <OwnerEditorField
                  label="Address"
                  value={editor.address}
                  onChangeText={(address) => patchEditor({ address })}
                />
                <OwnerEditorField
                  label="City"
                  value={editor.city}
                  onChangeText={(city) => patchEditor({ city })}
                />
                <OwnerEditorField
                  label="Phone"
                  value={editor.phone}
                  onChangeText={(phone) => patchEditor({ phone })}
                  keyboardType="phone-pad"
                />
                <OwnerEditorField
                  label="Website or social page"
                  value={editor.website}
                  onChangeText={(website) => patchEditor({ website })}
                  placeholder="https://..."
                  keyboardType="url"
                />
                <View style={s.ownerEditorRow}>
                  <View style={s.ownerEditorHalf}>
                    <OwnerEditorField
                      label="Opening time"
                      value={editor.openingTime}
                      onChangeText={(openingTime) =>
                        patchEditor({ openingTime })
                      }
                      placeholder="09:00"
                    />
                  </View>
                  <View style={s.ownerEditorHalf}>
                    <OwnerEditorField
                      label="Closing time"
                      value={editor.closingTime}
                      onChangeText={(closingTime) =>
                        patchEditor({ closingTime })
                      }
                      placeholder="18:00"
                    />
                  </View>
                </View>
              </>
            )}
            {editor.kind === "reply" && (
              <>
                <View style={s.ownerReplyNotice}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={22}
                    color={C.rose}
                  />
                  <Text style={[s.small, { flex: 1 }]}>
                    Publish as many replies as needed. Each reply appears in
                    order below the customer’s review.
                  </Text>
                </View>
                {editor.imageUri ? (
                  <View style={s.ownerEditorPhotoPreview}>
                    <Image
                      source={{ uri: editor.imageUri }}
                      style={s.ownerEditorPhoto}
                    />
                    <Pressable
                      onPress={() =>
                        patchEditor({ imageUri: null, imageData: null })
                      }
                      style={s.ownerEditorPhotoRemove}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={17}
                        color={C.white}
                      />
                      <Text style={s.reviewPhotoRemoveText}>Remove photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      void chooseImage("your review reply").then(
                        (photo) =>
                          photo &&
                          patchEditor({
                            imageUri: photo.uri,
                            imageData: photo.data,
                          }),
                      )
                    }
                    style={s.ownerEditorPhotoPicker}
                  >
                    <Ionicons name="images-outline" size={29} color={C.rose} />
                    <View style={s.salonCardGrow}>
                      <Text style={s.cardTitle}>Attach a reply photo</Text>
                      <Text style={s.small}>Optional · JPG, PNG, or WebP</Text>
                    </View>
                    <Ionicons name="add-circle" size={23} color={C.rose} />
                  </Pressable>
                )}
                <OwnerEditorField
                  label="Public reply"
                  value={editor.message}
                  onChangeText={(message) => patchEditor({ message })}
                  placeholder="Thank the customer or address their feedback..."
                  multiline
                />
                <Text style={s.ownerEditorCount}>
                  {editor.message.length}/1000
                </Text>
              </>
            )}
            {error && (
              <View style={s.authError}>
                <Ionicons name="alert-circle" size={20} color="#355C45" />
                <Text style={s.authErrorText}>{error}</Text>
              </View>
            )}
          </ScrollView>
          <View style={s.ownerEditorFooter}>
            <Pressable
              disabled={saving}
              onPress={() => setEditor(null)}
              style={[s.ownerEditorButton, s.ownerEditorCancel]}
            >
              <Text style={s.ownerEditorCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={onSave}
              style={[
                s.ownerEditorButton,
                s.ownerEditorSave,
                saving && s.buttonDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={19} color={C.white} />
                  <Text style={s.ownerEditorSaveText}>
                    {editor.kind === "reply" ? "Publish reply" : "Save changes"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function DesktopNavigation({
  screen,
  go,
  onLogout,
}: {
  screen: Screen;
  go: (screen: Screen) => void;
  onLogout: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const navWidth = useRef(new Animated.Value(76)).current;
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = hovered || pinned;

  const openNavigation = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
    setHovered(true);
  };

  const scheduleNavigationClose = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      setHovered(false);
      collapseTimer.current = null;
    }, 900);
  };

  const selectNavigationItem = (destination: Screen) => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
    setPinned(false);
    setHovered(false);
    go(destination);
  };

  useEffect(() => {
    Animated.timing(navWidth, {
      toValue: expanded ? 264 : 76,
      duration: expanded ? 260 : 220,
      useNativeDriver: false,
    }).start();
  }, [expanded, navWidth]);

  useEffect(
    () => () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    },
    [],
  );

  const detailOpacity = navWidth.interpolate({
    inputRange: [76, 180, 264],
    outputRange: [0, 0.2, 1],
    extrapolate: "clamp",
  });
  const items: {
    key: Screen;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "home", label: "Overview", icon: "grid-outline" },
    { key: "scan", label: "Face scan", icon: "scan-outline" },
    { key: "salons", label: "Find salons", icon: "storefront-outline" },
    { key: "bookings", label: "Bookings", icon: "calendar-outline" },
    { key: "saved", label: "Saved styles", icon: "heart-outline" },
    { key: "profile", label: "Profile", icon: "person-outline" },
  ];
  return (
    <View style={s.desktopNavRail}>
      <Animated.View
        onPointerEnter={openNavigation}
        onPointerLeave={scheduleNavigationClose}
        style={[s.desktopNav, { width: navWidth }]}
      >
        <View style={s.desktopNavHoverArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinned ? "Collapse hAIrfit menu" : "Keep hAIrfit menu open"
            }
            onPress={() => setPinned((value) => !value)}
            style={s.desktopBrand}
          >
            <View style={s.logoSmall}>
              <Image
                accessibilityLabel="hAIrfit logo"
                source={faceFitLogo}
                resizeMode="contain"
                style={s.logoImageSmall}
              />
            </View>
            <Animated.Text
              numberOfLines={1}
              style={[s.desktopBrandText, { opacity: detailOpacity }]}
            >
              hAIrfit
            </Animated.Text>
          </Pressable>
          <Animated.Text
            style={[s.desktopNavLabel, { opacity: detailOpacity }]}
          >
            MENU
          </Animated.Text>
          <View style={s.desktopNavItems}>
            {items.map((item) => {
              const active =
                screen === item.key ||
                (item.key === "scan" &&
                  [
                    "processing",
                    "result",
                    "recommendations",
                    "style-detail",
                  ].includes(screen)) ||
                (item.key === "profile" && screen === "settings");
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  key={item.key}
                  onPress={() => selectNavigationItem(item.key)}
                  style={({ pressed }) => [
                    s.desktopNavItem,
                    active && s.desktopNavItemActive,
                    pressed && s.pressed,
                  ]}
                >
                  <View style={s.desktopNavIcon}>
                    <Ionicons
                      name={
                        active
                          ? (item.icon.replace(
                              "-outline",
                              "",
                            ) as keyof typeof Ionicons.glyphMap)
                          : item.icon
                      }
                      size={20}
                      color={active ? C.rose : C.muted}
                    />
                  </View>
                  <Animated.Text
                    numberOfLines={1}
                    style={[
                      s.desktopNavText,
                      active && s.desktopNavTextActive,
                      { opacity: detailOpacity },
                    ]}
                  >
                    {item.label}
                  </Animated.Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              onPress={onLogout}
              style={({ pressed }) => [s.desktopNavItem, pressed && s.pressed]}
            >
              <View style={s.desktopNavIcon}>
                <Ionicons name="log-out-outline" size={20} color={C.muted} />
              </View>
              <Animated.Text
                numberOfLines={1}
                style={[s.desktopNavText, { opacity: detailOpacity }]}
              >
                Log out
              </Animated.Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function StaffPickerModal({
  visible,
  loading,
  staff,
  selectedId,
  dateLabel,
  timeLabel,
  onSelect,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  staff: SalonStaff[];
  selectedId?: number;
  dateLabel: string;
  timeLabel: string;
  onSelect: (staff: SalonStaff) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.staffModalBackdrop} onPress={onClose}>
        <Pressable
          style={s.staffModalSheet}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={s.staffModalHandle} />
          <View style={s.staffModalHeader}>
            <View style={s.salonCardGrow}>
              <Text style={s.eyebrow}>SALON TEAM</Text>
              <Text style={s.title}>Choose your stylist</Text>
              <Text style={s.small}>
                {dateLabel} · {timeLabel}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close staff selection"
              onPress={onClose}
              style={s.iconButton}
            >
              <Ionicons name="close" size={22} color={C.ink} />
            </Pressable>
          </View>
          {loading ? (
            <View style={s.staffModalState}>
              <ActivityIndicator size="large" color={C.rose} />
              <Text style={s.cardTitle}>Checking staff schedules…</Text>
            </View>
          ) : staff.length ? (
            <ScrollView contentContainerStyle={s.staffModalList}>
              {staff.map((member) => {
                const selected = selectedId === member.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={member.id}
                    onPress={() => onSelect(member)}
                    style={({ pressed }) => [
                      s.staffModalCard,
                      selected && s.staffModalCardSelected,
                      pressed && s.pressed,
                    ]}
                  >
                    {member.imageUrl ? (
                      <Image
                        source={{ uri: getApiAssetUrl(member.imageUrl)! }}
                        style={s.staffModalAvatar}
                      />
                    ) : (
                      <View style={s.staffModalAvatarFallback}>
                        <Text style={s.staffInitial}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={s.salonCardGrow}>
                      <Text style={s.cardTitle}>{member.name}</Text>
                      {member.hairstyleMatch && <Text style={s.availableText}>Recommended · specialty matches your haircut</Text>}
                      <Text style={s.small}>
                        {member.specialties || "Salon professional"}
                      </Text>
                      <View style={s.availableBadge}>
                        <View style={s.availableDot} />
                        <Text style={s.availableText}>
                          {member.isBusy ? 'Busy at this time ? join waiting queue' : 'Free for this appointment'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={
                        selected
                          ? "checkmark-circle"
                          : "chevron-forward-circle-outline"
                      }
                      size={28}
                      color={C.rose}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={s.staffModalState}>
              <View style={s.staffModalEmptyIcon}>
                <Ionicons name="time-outline" size={34} color={C.rose} />
              </View>
              <Text style={s.title}>No staff free at this time</Text>
              <Text style={[s.small, s.centerText]}>
                Try another appointment time, or continue and let the salon
                assign someone if availability changes.
              </Text>
              <Button
                label="Continue without staff"
                secondary
                onPress={onClose}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function FaceFitPrototype() {

    // --- ADD THIS WITH YOUR OTHER STATE DECLARATIONS ---
  const [aiPreviewImage, setAiPreviewImage] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [customHairstylePrompt, setCustomHairstylePrompt] = useState("");
  const [customHairstyleSuggestions, setCustomHairstyleSuggestions] = useState<FaceAnalysis["recommendations"]>([]);
  const [isSuggestingHairstyles, setIsSuggestingHairstyles] = useState(false);
  const [customSuggestionPreviewImages, setCustomSuggestionPreviewImages] = useState<Record<string, string>>({});
  const [customSuggestionPreviewLoading, setCustomSuggestionPreviewLoading] = useState<Record<string, boolean>>({});
  const [activeCustomSuggestionIndex, setActiveCustomSuggestionIndex] = useState(0);
  const [hairstylePreviewImages, setHairstylePreviewImages] = useState<Record<string, string>>({});
  const [hairstylePreviewLoading, setHairstylePreviewLoading] = useState<Record<string, boolean>>({});
  const [activeHairstyleIndex, setActiveHairstyleIndex] = useState(0);
  const [hairScalpAnalysis, setHairScalpAnalysis] = useState<HairScalpAnalysis | null>(null);
  const [isAnalyzingHairScalp, setIsAnalyzingHairScalp] = useState(false);
  const [isHairScalpModalVisible, setIsHairScalpModalVisible] = useState(false);

  const handleGenerateAiPreview = async (
  itemToPreview?: FaceAnalysis["recommendations"][number]
  ) => {
    const targetRecommendation = itemToPreview || selectedRecommendation;
    if (!targetRecommendation || isGeneratingAi) return;

    const imageBase64ToUse = uploadedImageData;

    if (!imageBase64ToUse) {
      Alert.alert("Missing Image", "Please capture or upload a face photo first.");
      return;
    }

    setIsGeneratingAi(true);
    setAiPreviewImage(null); // Clear previous preview while loading

    try {
      const response = await fetch(`${FACEFIT_API_URL}/api/ai-hairstyle-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64ToUse,
          prompt: `Change only the hairstyle to a ${targetRecommendation.name}. Keep the user's facial features and face shape identical.`,
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setAiPreviewImage(data.imageUrl);
      } else {
        Alert.alert("Preview Error", data.error || "Failed to generate preview.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Check if backend server is running.");
    } finally {
      setIsGeneratingAi(false);
    }
  };
  const generateMatchPreview = async (recommendation: FaceAnalysis["recommendations"][number]) => {
    if (!uploadedImageData || hairstylePreviewImages[recommendation.name] || hairstylePreviewLoading[recommendation.name]) return;
    setHairstylePreviewLoading((current) => ({ ...current, [recommendation.name]: true }));
    try {
      const response = await fetch(`${FACEFIT_API_URL}/api/ai-hairstyle-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: uploadedImageData,
          prompt: `Change only the hairstyle to a ${recommendation.name}. Keep the user's facial features and face shape identical.`,
        }),
      });
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setHairstylePreviewImages((current) => ({ ...current, [recommendation.name]: data.imageUrl }));
      }
    } catch {
      // Leave the preview card in its retryable placeholder state if the service is unavailable.
    } finally {
      setHairstylePreviewLoading((current) => ({ ...current, [recommendation.name]: false }));
    }
  };
  const generateCustomSuggestionPreview = async (recommendation: FaceAnalysis["recommendations"][number]) => {
    if (!uploadedImageData || customSuggestionPreviewImages[recommendation.name] || customSuggestionPreviewLoading[recommendation.name]) return;
    setCustomSuggestionPreviewLoading((current) => ({ ...current, [recommendation.name]: true }));
    try {
      const response = await fetch(`${FACEFIT_API_URL}/api/ai-hairstyle-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: uploadedImageData,
          prompt: `Change only the hairstyle to a ${recommendation.name}. Keep the user's facial features and face shape identical.`,
        }),
      });
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setCustomSuggestionPreviewImages((current) => ({ ...current, [recommendation.name]: data.imageUrl }));
      }
    } catch {
      // Keep this suggestion retryable if preview generation fails.
    } finally {
      setCustomSuggestionPreviewLoading((current) => ({ ...current, [recommendation.name]: false }));
    }
  };
  const handleAnalyzeHairScalp = async () => {
    if (isGuestAccount || !authToken) {
      setAuthError("Log in or create an account to unlock hair analysis and personalized care tips.");
      setScreen("login");
      return;
    }
    if (!uploadedImageData) {
      Alert.alert("Photo needed", "Capture or upload a photo before analyzing your hair.");
      return;
    }
    setIsHairScalpModalVisible(true);
    setIsAnalyzingHairScalp(true);
    setHairScalpAnalysis(null);
    try {
      const analysis = await analyzeHairAndScalp(uploadedImageData);
      setHairScalpAnalysis(analysis);
      if (authToken && userProfile) {
        try {
          const updatedProfile = await updateProfile(authToken, {
            fullName: userProfile.fullName,
            email: userProfile.email,
            phone: userProfile.phone || "",
            hairType: analysis.hairType.slice(0, 50),
            hairLength: analysis.hairLength.slice(0, 50),
            hairTexture: analysis.hairTexture.slice(0, 50),
          });
          setUserProfile(updatedProfile);
        } catch {
          Alert.alert("Analysis complete", "Your results are ready, but the hair profile could not be saved. Please try again later.");
        }
      }
    } catch (error) {
      setIsHairScalpModalVisible(false);
      Alert.alert("Analysis unavailable", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsAnalyzingHairScalp(false);
    }
  };
  const handleRequestHairstyleSuggestions = async () => {
    if (isGuestAccount) {
      setAuthError("Log in or create an account to request custom hairstyle suggestions.");
      setScreen("login");
      return;
    }
    const request = customHairstylePrompt.trim();
    if (!request || !faceAnalysis || isSuggestingHairstyles) return;
    if (!isValidHairstylePrompt(request)) return;
    setIsSuggestingHairstyles(true);
    setCustomHairstyleSuggestions([]);
    setCustomSuggestionPreviewImages({});
    setCustomSuggestionPreviewLoading({});
    setActiveCustomSuggestionIndex(0);
    try {
      const suggestions = await requestHairstyleSuggestions(
        faceAnalysis.faceShape,
        faceAnalysis.measurements,
        request,
        stylePreference,
      );
      setCustomHairstyleSuggestions(suggestions);
    } catch (error) {
      Alert.alert("Suggestions unavailable", error instanceof Error ? error.message : "Please try a different description.");
    } finally {
      setIsSuggestingHairstyles(false);
    }
  };
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const [screen, setScreen] = useState<Screen>("splash");
  const [sessionHydrating, setSessionHydrating] = useState(true);
  const [faceAnalysisConsent, setFaceAnalysisConsent] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [consentReturnScreen, setConsentReturnScreen] = useState<"login" | "signup">("signup");
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [salonDetailReturn, setSalonDetailReturn] = useState<
    "salons" | "nearby-map" | "saved-salons" | "reviews"
  >("salons");
  const [currentLocation, setCurrentLocation] = useState<MapCoordinate | null>(
    null,
  );
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadedImageData, setUploadedImageData] = useState<string | null>(null);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<
    FaceAnalysis["recommendations"][number] | null
  >(null);
  const [salonRecords, setSalonRecords] = useState<Salon[]>([]);
  const [styleSalonRecords, setStyleSalonRecords] = useState<Salon[] | null>(
    null,
  );
  const [selectedSalonHairstyle, setSelectedSalonHairstyle] = useState<string | null>(null);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [salonServices, setSalonServices] = useState<SalonService[]>([]);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<ServiceCategory>('All');
  const [ownerServiceCategoryFilter, setOwnerServiceCategoryFilter] = useState<ServiceCategory>('All');
  const [salonStaff, setSalonStaff] = useState<SalonStaff[]>([]);
  const [salonDetailTab, setSalonDetailTab] = useState<'Services' | 'Staff' | 'Reviews'>('Services');
  const [salonPortfolioImages, setSalonPortfolioImages] = useState<
    PortfolioImage[]
  >([]);
  const [salonReviews, setSalonReviews] = useState<SalonReview[]>([]);
  const [salonReviewSummary, setSalonReviewSummary] =
    useState<SalonReviewSummary>({ count: 0, average: 0 });
  const [salonDetailLoading, setSalonDetailLoading] = useState(false);
  const [salonDetailError, setSalonDetailError] = useState<string | null>(null);
  const salonLoadRequestRef = useRef(0);
  const [salonsLoading, setSalonsLoading] = useState(true);
  const [salonsError, setSalonsError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isGuestAccount, setIsGuestAccount] = useState(false);
  const [guestScanUsed, setGuestScanUsed] = useState(false);
  const [ownerDashboard, setOwnerDashboard] = useState<OwnerDashboard | null>(
    null,
  );
  const ownerDashboardRequestRef = useRef(0);
  const [ownerDashboardLoading, setOwnerDashboardLoading] = useState(false);
  const [ownerDashboardError, setOwnerDashboardError] = useState<string | null>(
    null,
  );
  const [ownerManagement, setOwnerManagement] =
    useState<OwnerManagement | null>(null);
  const [ownerManagementLoading, setOwnerManagementLoading] = useState(false);
  const [ownerManagementError, setOwnerManagementError] = useState<
    string | null
  >(null);
  const [ownerBookingUpdating, setOwnerBookingUpdating] = useState<
    number | null
  >(null);
  const [ownerEditor, setOwnerEditor] = useState<OwnerEditor | null>(null);
  const [ownerEditorSaving, setOwnerEditorSaving] = useState(false);
  const [ownerEditorError, setOwnerEditorError] = useState<string | null>(null);
  const [ownerRemoving, setOwnerRemoving] = useState<string | null>(null);
  const [confirmationPrompt, setConfirmationPrompt] =
    useState<ConfirmationPromptData | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [selectedAccountItem, setSelectedAccountItem] =
    useState<AccountItem | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationReturnScreen, setNotificationReturnScreen] =
    useState<Screen>("home");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [favoriteSalonIds, setFavoriteSalonIds] = useState<number[]>([]);
  const [savingFavoriteSalonIds, setSavingFavoriteSalonIds] = useState<
    number[]
  >([]);
  const [favoriteToast, setFavoriteToast] = useState<{
    message: string;
    success: boolean;
  } | null>(null);
  const dismissFavoriteToast = useCallback(() => setFavoriteToast(null), []);
  const favoriteSalonIdsRef = useRef<number[]>([]);
  const favoriteMutationsRef = useRef(
    new Map<
      number,
      { desired: boolean; confirmed: boolean; running: boolean }
    >(),
  );
  const [bookingRecords, setBookingRecords] = useState<Booking[]>([]);
  const [clientBookingFilter, setClientBookingFilter] = useState<BookingFilter>('all');
  const [ownerTab, setOwnerTab] = useState<OwnerTab>('dashboard');
  const [ownerScrollRequest, setOwnerScrollRequest] = useState<{ tab: OwnerTab; id: number }>({ tab: 'dashboard', id: 0 });
  const [ownerBookingFilter, setOwnerBookingFilter] = useState<BookingFilter>('all');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [stylePreference, setStylePreference] = useState<"men" | "women">("men");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<"customer" | "owner">(
    "customer",
  );
  const [salonName, setSalonName] = useState("");
  const [salonAddress, setSalonAddress] = useState("");
  const [salonCity, setSalonCity] = useState("Nasugbu");
  const [salonLatitude, setSalonLatitude] = useState("14.0667");
  const [salonLongitude, setSalonLongitude] = useState("120.6333");
  const [salonLogoUri, setSalonLogoUri] = useState<string | null>(null);
  const [salonLogoData, setSalonLogoData] = useState<string | undefined>();
  const [ownerSalonRecoveryAttempted, setOwnerSalonRecoveryAttempted] =
    useState(false);
  const [salonView, setSalonView] = useState<"list" | "map">("list");
  const [salonSearchQuery, setSalonSearchQuery] = useState("");
  const [showOpenSalonsOnly, setShowOpenSalonsOnly] = useState(false);
  const [selectedService, setSelectedService] = useState<SalonService | null>(
    null,
  );
  const [selectedStylist, setSelectedStylist] = useState<SalonStaff | null>(
    null,
  );
  const [quickProfileStylist, setQuickProfileStylist] = useState<SalonStaff | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImageData, setReviewImageData] = useState<
    string | null | undefined
  >(undefined);
  const [reviewImageUri, setReviewImageUri] = useState<string | null>(null);
  const [mySalonReviewIds, setMySalonReviewIds] = useState<number[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [stylistReviewDrafts, setStylistReviewDrafts] = useState<Record<number, { rating: number; comment: string }>>({});
  const [stylistReviewSavingId, setStylistReviewSavingId] = useState<number | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const [staffPickerVisible, setStaffPickerVisible] = useState(false);
  const [staffPickerLoading, setStaffPickerLoading] = useState(false);
  const [bookedStylistId, setBookedStylistId] = useState<number | null>(null);
  const staffAvailabilityRequest = useRef(0);
  const [lastBookingId, setLastBookingId] = useState<number | null>(null);
  const back = (fallback: Screen = "home") => setScreen(fallback);
  const requestLogout = (onConfirm: () => void) =>
    setConfirmationPrompt({
      eyebrow: "ACCOUNT",
      title: "Log out of hAIrfit?",
      message:
        "You’ll need to log in again to access your saved styles, appointments, and account details.",
      icon: "log-out-outline",
      showIcon: false,
      showEyebrow: false,
      centerTitle: true,
      confirmLabel: "Yes, log out",
      cancelLabel: "No, stay",
      onConfirm,
    });
  const logout = () =>
    requestLogout(() => {
      void AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY).catch(() => {});
      ownerDashboardRequestRef.current += 1;
      setAuthUser(null);
      setAuthToken(null);
      setUserProfile(null);
      setOwnerDashboard(null);
      setOwnerDashboardError(null);
      setOwnerManagement(null);
      setOwnerSalonRecoveryAttempted(false);
      setSalonName("");
      setSalonAddress("");
      setSalonCity("Nasugbu");
      setSalonLatitude("14.0667");
      setSalonLongitude("120.6333");
      setSalonLogoUri(null);
      setSalonLogoData(undefined);
      setIsGuestAccount(false);
      setScreen("login");
    });
  const saveHairstyleForCustomer = (hairstyleName: string) => {
    if (!authToken) {
      setConfirmationPrompt({
        eyebrow: "SAVE HAIRSTYLE",
        title: "Save this style to your account",
        message: "Log in or create an account to keep this haircut in your saved hairstyles.",
        icon: "heart-outline",
        confirmLabel: "Log in",
        cancelLabel: "Sign up",
        onConfirm: () => {
          setAuthError(null);
          setScreen("login");
        },
        onCancel: () => {
          setAuthError(null);
          setScreen("signup");
        },
      });
      return;
    }
    void saveHairstyle(authToken, hairstyleName)
      .then(() => setFavoriteToast({ message: `${hairstyleName} saved to your account.`, success: true }))
      .catch((error) => setFavoriteToast({
        message: error instanceof Error ? error.message : "Unable to save this hairstyle. Please try again.",
        success: false,
      }));
  };
  const mainScreens = [
    "home",
    "scan",
    "processing",
    "result",
    "recommendations",
    "style-detail",
    "salons",
    "bookings",
    "profile",
  ] as Screen[];

  useEffect(() => {
    if (screen === "splash" && !sessionHydrating) {
      const t = setTimeout(() => setScreen("onboarding"), 1400);
      return () => clearTimeout(t);
    }
  }, [screen, sessionHydrating]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
        if (!stored) return;

        const parsed = JSON.parse(stored) as { token?: unknown; user?: AuthUser };
        if (typeof parsed.token !== "string" || !parsed.token || !parsed.user?.id || !parsed.user.role) {
          await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
          return;
        }

        let profile: UserProfile | null = null;
        let sessionInvalid = false;
        try {
          profile = await getProfile(parsed.token);
        } catch (error) {
          sessionInvalid = (error as Error & { status?: number }).status === 401;
          // Keep the session when profile enrichment is temporarily unavailable.
        }
        if (sessionInvalid) {
          await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
          return;
        }
        if (cancelled) return;

        const user = profile || parsed.user;
        let hasAcceptedTerms = false;
        if (user.role === "customer") {
          try {
            const consent = await AsyncStorage.getItem(consentStorageKey(user.id));
            if (consent) {
              const saved = JSON.parse(consent) as { version?: number; faceAnalysis?: boolean; location?: boolean };
              hasAcceptedTerms = saved.version === CONSENT_VERSION && saved.faceAnalysis === true && saved.location === true;
            }
          } catch {
            // Missing or malformed consent means the customer must review it again.
          }
        }
        if (cancelled) return;

        setAuthUser(user);
        setAuthToken(parsed.token);
        setUserProfile(profile);
        setIsGuestAccount(false);
        setGuestScanUsed(false);
        setFaceAnalysisConsent(hasAcceptedTerms);
        setLocationConsent(hasAcceptedTerms);
        setConsentReturnScreen("login");
        if (profile?.stylePreference === "men" || profile?.stylePreference === "women") {
          setStylePreference(profile.stylePreference);
        }
        setScreen(
          user.role === "owner"
            ? "owner-dashboard"
            : user.role === "stylist"
              ? "stylist-dashboard"
              : hasAcceptedTerms
                ? "home"
                : "consent",
        );
      } catch {
        await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY).catch(() => {});
      } finally {
        if (!cancelled) setSessionHydrating(false);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);
  const loadSalons = useCallback(async () => {
    setSalonsLoading(true);
    setSalonsError(null);
    try {
      setSalonRecords(await getSalons());
    } catch (error) {
      setSalonsError(
        error instanceof Error ? error.message : "Unable to load salons.",
      );
    } finally {
      setSalonsLoading(false);
    }
  }, []);
  const findSalonsForStyle = async (hairstyle: string) => {
    if (!authToken || isGuestAccount) {
      requireGuestLogin("Log in or create an account to find a salon and book this hairstyle.");
      return;
    }
    const recommendation =
      faceAnalysis?.recommendations.find((item) => item.name === hairstyle) ||
      customHairstyleSuggestions.find((item) => item.name === hairstyle);
    setSelectedRecommendation(recommendation || null);
    setSelectedSalonHairstyle(hairstyle);
    setSalonSearchQuery("");
    setStyleSalonRecords(null);
    setScreen("salons");
    setSalonsLoading(true);
    setSalonsError(null);
    try {
      setStyleSalonRecords(await getSalons(hairstyle));
    } catch (error) {
      setStyleSalonRecords([]);
      setSalonsError(
        error instanceof Error
          ? error.message
          : "Unable to find salons for this hairstyle.",
      );
    } finally {
      setSalonsLoading(false);
    }
  };
  useEffect(() => {
    void loadSalons();
  }, [loadSalons]);
  const loadBookings = useCallback(async (showLoading = true) => {
    if (!authToken) return;
    if (showLoading) setBookingsLoading(true);
    setBookingsError(null);
    try {
      setBookingRecords(await getBookings(authToken));
    } catch (error) {
      setBookingsError(
        error instanceof Error ? error.message : "Unable to load bookings.",
      );
    } finally {
      setBookingsLoading(false);
    }
  }, [authToken]);
  const submitStylistFeedback = async (booking: Booking) => {
    if (!authToken) return;
    const draft = stylistReviewDrafts[booking.id];
    if (!draft?.rating || stylistReviewSavingId !== null) return;
    setStylistReviewSavingId(booking.id);
    try {
      await reviewStylist(authToken, booking.id, draft.rating, draft.comment);
      setBookingRecords(current => current.map(item => item.id === booking.id ? { ...item, stylistReviewRating: draft.rating, stylistReviewComment: draft.comment } : item));
      setStylistReviewDrafts(current => { const next = { ...current }; delete next[booking.id]; return next; });
    } catch (error) {
      Alert.alert('Could not send feedback', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setStylistReviewSavingId(null);
    }
  };
  useEffect(() => {
    if (screen === "bookings") void loadBookings();
  }, [loadBookings, screen]);
  const loadProfile = useCallback(async () => {
    if (!authToken) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const profileData = await getProfile(authToken);
      setUserProfile(profileData);
      setAuthUser(profileData);
      if (profileData.stylePreference === "men" || profileData.stylePreference === "women") {
        setStylePreference(profileData.stylePreference);
      }
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Unable to load your profile.",
      );
    } finally {
      setProfileLoading(false);
    }
  }, [authToken]);
  useEffect(() => {
    if (screen === "profile") void loadProfile();
  }, [loadProfile, screen]);
  const loadOwnerDashboard = useCallback(async () => {
    if (!authToken || authUser?.role !== "owner") return;
    const requestId = ++ownerDashboardRequestRef.current;
    setOwnerDashboardLoading(true);
    setOwnerDashboardError(null);
    try {
      const dashboard = await getOwnerDashboard(authToken);
      if (requestId !== ownerDashboardRequestRef.current) return;
      setOwnerDashboard(dashboard);
    } catch (error) {
      if (requestId !== ownerDashboardRequestRef.current) return;
      setOwnerDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to load the salon dashboard.",
      );
    } finally {
      if (requestId === ownerDashboardRequestRef.current) {
        setOwnerDashboardLoading(false);
      }
    }
  }, [authToken, authUser?.role]);
  useEffect(() => {
    if (screen === "owner-dashboard") void loadOwnerDashboard();
  }, [loadOwnerDashboard, screen]);
  useEffect(() => {
    if (
      screen !== "owner-dashboard" ||
      !authToken ||
      authUser?.role !== "owner"
    )
      return;
    const refreshTimer = setInterval(() => void loadOwnerDashboard(), 10000);
    return () => clearInterval(refreshTimer);
  }, [authToken, authUser?.role, loadOwnerDashboard, screen]);
  useEffect(() => {
    if (
      ownerSalonRecoveryAttempted ||
      !authToken ||
      authUser?.role !== "owner" ||
      !ownerDashboardError?.includes("No salon is linked") ||
      !salonName ||
      !salonAddress ||
      !salonCity
    )
      return;
    setOwnerSalonRecoveryAttempted(true);
    void createOwnerSalon(authToken, {
      name: salonName,
      address: salonAddress,
      city: salonCity,
      latitude: Number(salonLatitude),
      longitude: Number(salonLongitude),
      logoData: salonLogoData,
    })
      .then(() => Promise.all([loadOwnerDashboard(), loadSalons()]))
      .catch((error) =>
        setOwnerDashboardError(
          error instanceof Error
            ? error.message
            : "Unable to finish salon setup.",
        ),
      );
  }, [
    authToken,
    authUser?.role,
    loadOwnerDashboard,
    loadSalons,
    ownerDashboardError,
    ownerSalonRecoveryAttempted,
    salonAddress,
    salonCity,
    salonLatitude,
    salonLogoData,
    salonLongitude,
    salonName,
  ]);
  const loadOwnerManagement = useCallback(async (showLoading = true) => {
    if (!authToken || authUser?.role !== "owner") return;
    if (showLoading) setOwnerManagementLoading(true);
    setOwnerManagementError(null);
    try {
      setOwnerManagement(await getOwnerManagement(authToken));
    } catch (error) {
      setOwnerManagementError(
        error instanceof Error
          ? error.message
          : "Unable to load salon management data.",
      );
    } finally {
      setOwnerManagementLoading(false);
    }
  }, [authToken, authUser?.role]);
  useEffect(() => {
    if (
      screen.startsWith("owner-") &&
      screen !== "owner-dashboard" &&
      screen !== "owner-notifications"
    )
      void loadOwnerManagement();
  }, [loadOwnerManagement, screen]);

  const changeOwnerBookingStatus = async (
    bookingId: number,
    status: "confirmed" | "completed" | "cancelled",
  ) => {
    if (!authToken || ownerBookingUpdating) return;
    setOwnerBookingUpdating(bookingId);
    try {
      await updateOwnerBooking(authToken, bookingId, status);
      await Promise.all([loadOwnerManagement(), loadOwnerDashboard()]);
    } catch (error) {
      Alert.alert(
        "Unable to update booking",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setOwnerBookingUpdating(null);
    }
  };

  const saveOwnerEditor = async () => {
    if (!authToken || !ownerEditor || ownerEditorSaving) return;
    setOwnerEditorSaving(true);
    setOwnerEditorError(null);
    try {
      if (ownerEditor.kind === "service") {
        const input = {
          name: ownerEditor.name,
          description: ownerEditor.description,
          price: Number(ownerEditor.price),
          durationMinutes: Number(ownerEditor.durationMinutes),
          isActive: ownerEditor.isActive,
        };
        if (ownerEditor.id)
          await updateOwnerService(authToken, ownerEditor.id, input);
        else await createOwnerService(authToken, input);
      } else if (ownerEditor.kind === "staff") {
        const input = {
          name: ownerEditor.name,
          email: ownerEditor.email,
          phone: ownerEditor.phone,
          specialties: ownerEditor.specialties,
          password: ownerEditor.password,
          isAvailable: ownerEditor.isAvailable,
          imageData: ownerEditor.imageData,
        };
        if (ownerEditor.id)
          await updateOwnerStaff(authToken, ownerEditor.id, input);
        else await createOwnerStaff(authToken, input);
      } else if (ownerEditor.kind === "profile") {
        const {
          name,
          description,
          address,
          city,
          phone,
          website,
          openingTime,
          closingTime,
          imageData,
        } = ownerEditor;
        await updateOwnerProfile(authToken, {
          name,
          description,
          address,
          city,
          phone,
          website,
          openingTime,
          closingTime,
          imageData,
        });
      } else {
        await createOwnerReviewReply(
          authToken,
          ownerEditor.reviewId,
          ownerEditor.message,
          ownerEditor.imageData,
        );
      }
      setOwnerEditor(null);
      await Promise.all([loadOwnerManagement(), loadOwnerDashboard()]);
    } catch (error) {
      setOwnerEditorError(
        error instanceof Error ? error.message : "Unable to save your changes.",
      );
    } finally {
      setOwnerEditorSaving(false);
    }
  };

  const confirmOwnerRemoval = (
    kind: "service" | "staff",
    id: number,
    label: string,
  ) => {
    if (!authToken || ownerRemoving) return;
    const message = `${label} will no longer appear in your management list or to customers. Existing booking history will be kept.`;
    const remove = () => {
      setOwnerRemoving(`${kind}-${id}`);
      const request =
        kind === "service"
          ? removeOwnerService(authToken, id)
          : removeOwnerStaff(authToken, id);
      void request
        .then(() => Promise.all([loadOwnerManagement(), loadOwnerDashboard()]))
        .catch((error) => {
          Alert.alert(
            `Unable to remove ${kind}`,
            error instanceof Error ? error.message : "Please try again.",
          );
        })
        .finally(() => setOwnerRemoving(null));
    };
    setConfirmationPrompt({
      eyebrow: "SALON MANAGEMENT",
      title: `Remove ${kind}?`,
      message,
      icon: "trash-outline",
      confirmLabel: "Yes, remove",
      cancelLabel: "No, keep it",
      onConfirm: remove,
    });
  };

  const addPortfolioPhoto = async () => {
    if (!authToken || ownerRemoving) return;
    const photo = await chooseImage("your business portfolio");
    if (!photo) return;
    setOwnerRemoving("portfolio-add");
    try {
      await createOwnerPortfolioImage(authToken, photo.data);
      await loadOwnerManagement();
    } catch (error) {
      Alert.alert(
        "Unable to add portfolio photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setOwnerRemoving(null);
    }
  };

  const confirmMediaRemoval = (
    kind: "portfolio photo" | "reply",
    id: number,
  ) => {
    if (!authToken || ownerRemoving) return;
    const remove = () => {
      setOwnerRemoving(`${kind}-${id}`);
      const request =
        kind === "portfolio photo"
          ? removeOwnerPortfolioImage(authToken, id)
          : removeOwnerReviewReply(authToken, id);
      void request
        .then(() => loadOwnerManagement())
        .catch((error) =>
          Alert.alert(
            `Unable to remove ${kind}`,
            error instanceof Error ? error.message : "Please try again.",
          ),
        )
        .finally(() => setOwnerRemoving(null));
    };
    const message = `This ${kind} will be removed from the customer view.`;
    setConfirmationPrompt({
      eyebrow: "SALON MANAGEMENT",
      title: `Remove ${kind}?`,
      message,
      icon: "trash-outline",
      confirmLabel: "Yes, remove",
      cancelLabel: "No, keep it",
      onConfirm: remove,
    });
  };

  const loadAccountScreen = useCallback(async (showLoading = true) => {
    if (
      !authToken ||
      ![
        "saved",
        "saved-salons",
        "notifications",
        "owner-notifications",
        "reviews",
      ].includes(screen)
    )
      return;
    if (showLoading) setAccountLoading(true);
    setAccountError(null);
    try {
      setAccountItems(
        await getAccountItems(
          authToken,
          screen === "saved-salons"
            ? "salons"
            : screen === "owner-notifications"
              ? "notifications"
              : (screen as "saved" | "notifications" | "reviews"),
        ),
      );
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Unable to load this page.",
      );
    } finally {
      setAccountLoading(false);
    }
  }, [authToken, screen]);
  useEffect(() => {
    void loadAccountScreen();
  }, [loadAccountScreen]);

  const loadNotificationCount = useCallback(async () => {
    if (!authToken) {
      setNotificationUnreadCount(0);
      return;
    }
    try {
      setNotificationUnreadCount(await getUnreadNotificationCount(authToken));
    } catch {
      // Keep the last known badge count when the API is temporarily unavailable.
    }
  }, [authToken]);
  useEffect(() => {
    void loadNotificationCount();
  }, [loadNotificationCount, screen]);

  useEffect(() => {
    if (!authToken) return;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        await Promise.all([
          loadNotificationCount(),
          ...(screen === "bookings" ? [loadBookings(false)] : []),
          ...(screen === "owner-bookings" ? [loadOwnerManagement(false)] : []),
          ...(screen === "notifications" || screen === "owner-notifications"
            ? [loadAccountScreen(false)] : []),
        ]);
      } finally { refreshing = false; }
    };
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [authToken, screen, loadNotificationCount, loadAccountScreen, loadBookings, loadOwnerManagement]);

  const openNotification = async (item: AccountItem, owner: boolean) => {
    if (!owner && item.destination === "reviews" && item.salonId) {
      const salonId = Number(item.salonId);
      let salon = salonRecords.find((record) => record.id === salonId);

      if (!salon) {
        try {
          const latestSalons = await getSalons();
          setSalonRecords(latestSalons);
          salon = latestSalons.find((record) => record.id === salonId);
        } catch {
          // The standard reviews destination below remains available if salons cannot be refreshed.
        }
      }

      if (salon) {
        await openSalon(salon);
        return;
      }
    }

    const destinations: Record<string, Screen> = {
      bookings: "bookings",
      reviews: "reviews",
      "owner-bookings": "owner-bookings",
      "owner-reviews": "owner-reviews",
    };
    const target = item.destination
      ? destinations[item.destination]
      : undefined;
    if (
      target &&
      (owner ? target.startsWith("owner-") : !target.startsWith("owner-"))
    ) {
      if (target === "bookings") setClientBookingFilter("all");
      if (target === "owner-bookings") setOwnerBookingFilter("all");
      setScreen(target);
    }
  };

  const showNotifications = (returnScreen: Screen) => {
    setNotificationReturnScreen(returnScreen);
    setScreen("notifications");
  };

  const readNotification = (item: AccountItem) => {
    if (!authToken || Boolean(item.isRead)) return;
    setAccountItems((items) =>
      items.map((notification) =>
        notification.id === item.id
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
    setNotificationUnreadCount((count) => Math.max(0, count - 1));
    void markNotificationRead(authToken, item.id).catch(() => {
      setAccountItems((items) =>
        items.map((notification) =>
          notification.id === item.id
            ? { ...notification, isRead: false }
            : notification,
        ),
      );
      setNotificationUnreadCount((count) => count + 1);
    });
  };

  useEffect(() => {
    if (!authToken) {
      favoriteSalonIdsRef.current = [];
      favoriteMutationsRef.current.clear();
      setFavoriteSalonIds([]);
      return;
    }
    void getFavoriteSalons(authToken)
      .then((ids) => {
        const visibleIds = new Set(ids);
        favoriteMutationsRef.current.forEach((mutation, salonId) => {
          if (mutation.desired) visibleIds.add(salonId);
          else visibleIds.delete(salonId);
        });
        favoriteSalonIdsRef.current = [...visibleIds];
        setFavoriteSalonIds([...visibleIds]);
      })
      .catch(() => {
        if (favoriteMutationsRef.current.size === 0) {
          favoriteSalonIdsRef.current = [];
          setFavoriteSalonIds([]);
        }
      });
  }, [authToken]);

  const showFavoriteState = (salonId: number, favorite: boolean) => {
    const next = favorite
      ? [...new Set([...favoriteSalonIdsRef.current, salonId])]
      : favoriteSalonIdsRef.current.filter((id) => id !== salonId);
    favoriteSalonIdsRef.current = next;
    setFavoriteSalonIds(next);
  };

  const syncFavoriteSalon = async (
    salonId: number,
    salonName: string,
    token: string,
  ) => {
    const mutation = favoriteMutationsRef.current.get(salonId);
    if (!mutation || mutation.running) return;
    mutation.running = true;
    setSavingFavoriteSalonIds((ids) =>
      ids.includes(salonId) ? ids : [...ids, salonId],
    );

    try {
      while (mutation.confirmed !== mutation.desired) {
        const target = mutation.desired;
        await setFavoriteSalon(token, salonId, target);
        mutation.confirmed = target;
      }
      setFavoriteToast({
        message: mutation.confirmed
          ? `${salonName} saved to your favorites`
          : `${salonName} removed from saved salons`,
        success: true,
      });
    } catch (error) {
      showFavoriteState(salonId, mutation.confirmed);
      setFavoriteToast({
        message:
          error instanceof Error ? error.message : "Unable to update favorite",
        success: false,
      });
    } finally {
      favoriteMutationsRef.current.delete(salonId);
      setSavingFavoriteSalonIds((ids) => ids.filter((id) => id !== salonId));
    }
  };

  const toggleFavoriteSalon = (salonId: number) => {
    if (!authToken) {
      Alert.alert("Log in required", "Log in to save favorite salons.");
      return;
    }
    const currentFavorite = favoriteSalonIdsRef.current.includes(salonId);
    const desired = !currentFavorite;
    const salonName =
      salonRecords.find((salon) => salon.id === salonId)?.name || "Salon";
    showFavoriteState(salonId, desired);

    const existing = favoriteMutationsRef.current.get(salonId);
    if (existing) {
      existing.desired = desired;
      return;
    }
    favoriteMutationsRef.current.set(salonId, {
      desired,
      confirmed: currentFavorite,
      running: false,
    });
    void syncFavoriteSalon(salonId, salonName, authToken);
  };

  const openSalon = async (
    salon: Salon,
    returnTo: "salons" | "nearby-map" | "saved-salons" | "reviews" = "salons",
    preferredStylist?: SalonStaff,
    preferredHairstyle?: string,
  ) => {
    setSalonDetailTab('Services');
    const requestId = ++salonLoadRequestRef.current;
    setSalonDetailReturn(returnTo);
    setSelectedSalon(salon);
    setSalonServices([]);
    setServiceCategoryFilter('All');
    setSalonStaff([]);
    setSalonPortfolioImages([]);
    setSalonReviews([]);
    setSalonReviewSummary({ count: 0, average: 0 });
    setSelectedService(null);
    setSelectedStylist(null);
    setBookedStylistId(preferredStylist?.id || null);
    staffAvailabilityRequest.current++;
    setSelectedDate(null);
    setSelectedTime(null);
    setReviewRating(0);
    setReviewComment("");
    setReviewImageData(undefined);
    setReviewImageUri(null);
    setMySalonReviewIds([]);
    setEditingReviewId(null);
    setSalonDetailError(null);
    setSalonDetailLoading(true);
    setScreen("salon-detail");
    const [
      servicesResult,
      staffResult,
      portfolioResult,
      reviewsResult,
      myReviewResult,
    ] = await Promise.allSettled([
      getSalonServices(salon.id),
      getSalonStaff(salon.id),
      getSalonPortfolio(salon.id),
      getSalonReviews(salon.id),
      authToken ? getMySalonReviews(authToken, salon.id) : Promise.resolve([]),
    ]);
    if (requestId !== salonLoadRequestRef.current) return;
    if (servicesResult.status === "fulfilled") {
      setSalonServices(servicesResult.value);
      if (selectedRecommendation || preferredHairstyle) {
        const recommendedService =
          servicesResult.value.find(
            (service) => service.name === "Premium Style Haircut",
          ) ||
          servicesResult.value.find((service) =>
            /haircut|hair cut|style|cut/i.test(service.name),
          ) ||
          servicesResult.value[0];
        setSelectedService(recommendedService || null);
      }
    }
    if (staffResult.status === "fulfilled") {
      setSalonStaff(staffResult.value);
      if (preferredStylist) setSelectedStylist(staffResult.value.find(member => member.id === preferredStylist.id) || null);
    }
    if (portfolioResult.status === "fulfilled")
      setSalonPortfolioImages(portfolioResult.value);
    if (reviewsResult.status === "fulfilled") {
      setSalonReviews(reviewsResult.value.reviews);
      setSalonReviewSummary(reviewsResult.value.summary);
    }
    if (myReviewResult.status === "fulfilled")
      setMySalonReviewIds(myReviewResult.value.map((review) => review.id));
    if (
      [
        servicesResult,
        staffResult,
        portfolioResult,
        reviewsResult,
        myReviewResult,
      ].some((result) => result.status === "rejected")
    ) {
      setSalonDetailError(
        "Some salon information could not be loaded. Tap to try again.",
      );
    }
    setSalonDetailLoading(false);
    if (preferredStylist) {
      const member = staffResult.status === 'fulfilled' && staffResult.value.find(item => item.id === preferredStylist.id);
      const service = servicesResult.status === 'fulfilled' && (servicesResult.value.find(item => item.name === 'Premium Style Haircut') || servicesResult.value.find(item => /haircut|hair cut|\bcut\b/i.test(item.name)));
      if (!member || !service) throw new Error('This stylist or haircut service is unavailable. Please choose another stylist.');
      setSelectedService(service);
      setSelectedStylist(member);
      setScreen('datetime');
    }
  };

  const submitSalonReview = async () => {
    if (!authToken || !selectedSalon || reviewSaving || reviewRating === 0)
      return;
    setReviewSaving(true);
    try {
      const input = {
        rating: reviewRating,
        comment: reviewComment,
        imageData: reviewImageData,
      };
      if (editingReviewId)
        await updateSalonReview(authToken, editingReviewId, input);
      else await createSalonReview(authToken, selectedSalon.id, input);
      const [latest, mine] = await Promise.all([
        getSalonReviews(selectedSalon.id),
        getMySalonReviews(authToken, selectedSalon.id),
      ]);
      setSalonReviews(latest.reviews);
      setSalonReviewSummary(latest.summary);
      setMySalonReviewIds(mine.map((review) => review.id));
      const wasEditing = editingReviewId !== null;
      setReviewRating(0);
      setReviewComment("");
      setReviewImageUri(null);
      setReviewImageData(undefined);
      setEditingReviewId(null);
      setFavoriteToast({
        message: `Your review for ${selectedSalon.name} was ${wasEditing ? "updated" : "published"}`,
        success: true,
      });
    } catch (error) {
      setFavoriteToast({
        message:
          error instanceof Error ? error.message : "Unable to save your review",
        success: false,
      });
    } finally {
      setReviewSaving(false);
    }
  };

  const editSalonReview = (review: SalonReview) => {
    setEditingReviewId(review.id);
    setReviewRating(review.rating);
    setReviewComment(review.comment || "");
    setReviewImageUri(getApiAssetUrl(review.imageUrl));
    setReviewImageData(undefined);
  };

  const cancelReviewEdit = () => {
    setEditingReviewId(null);
    setReviewRating(0);
    setReviewComment("");
    setReviewImageUri(null);
    setReviewImageData(undefined);
  };

  const pickReviewImage = async () => {
    const photo = await chooseImage("your review");
    if (!photo) return;
    setReviewImageUri(photo.uri);
    setReviewImageData(photo.data);
  };

  const submitAuth = async (isSignup: boolean) => {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError(null);
    setOwnerSalonRecoveryAttempted(false);
    try {
      setOwnerTab("dashboard");
      setOwnerScrollRequest(previous => ({ tab: "dashboard", id: previous.id + 1 }));
      const result = isSignup
        ? await signupUser({
            fullName,
            email,
            phone,
            password,
            role: accountRole,
            ...(accountRole === "customer" ? { stylePreference } : {}),
            ...(accountRole === "owner"
              ? {
                  salonName,
                  salonAddress,
                  salonCity,
                  latitude: Number(salonLatitude),
                  longitude: Number(salonLongitude),
                  salonLogoData,
                }
              : {}),
          })
        : await loginUser({ email, password });
      let authenticatedProfile: UserProfile | null = null;
      if (result.user.role === "customer") {
        try {
          authenticatedProfile = await getProfile(result.token);
          if (authenticatedProfile.stylePreference === "men" || authenticatedProfile.stylePreference === "women") {
            setStylePreference(authenticatedProfile.stylePreference);
          }
        } catch {
          // Keep the selected registration preference if profile loading is temporarily unavailable.
        }
      }
      let hasAcceptedTerms = false;
      if (result.user.role === "customer" && !isSignup) {
        try {
          const storedConsent = await AsyncStorage.getItem(
            consentStorageKey(result.user.id),
          );
          if (storedConsent) {
            const consent = JSON.parse(storedConsent) as {
              version?: number;
              faceAnalysis?: boolean;
              location?: boolean;
            };
            hasAcceptedTerms =
              consent.version === CONSENT_VERSION &&
              consent.faceAnalysis === true &&
              consent.location === true;
          }
        } catch {
          // If saved consent cannot be read, ask the customer again.
        }
      }
      setAuthUser(result.user);
      setAuthToken(result.token);
      try {
        await AsyncStorage.setItem(
          AUTH_SESSION_STORAGE_KEY,
          JSON.stringify({ token: result.token, user: result.user }),
        );
      } catch {
        // The current session remains usable even if device storage is unavailable.
      }
      setIsGuestAccount(false);
      setGuestScanUsed(false);
      setUserProfile(authenticatedProfile);
      setFaceAnalysisConsent(hasAcceptedTerms);
      setLocationConsent(hasAcceptedTerms);
      setConsentReturnScreen(isSignup ? "signup" : "login");
      setConsentError(null);
      setPassword("");
      setScreen(
        result.user.role === "owner"
          ? "owner-dashboard"
          : result.user.role === "stylist"
            ? "stylist-dashboard"
          : hasAcceptedTerms
            ? "home"
            : "consent",
      );
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to authenticate.",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const acceptConsent = async () => {
    if (!faceAnalysisConsent || !locationConsent || consentSaving) return;
    if (!authUser) {
      setScreen("login");
      return;
    }
    setConsentSaving(true);
    setConsentError(null);
    try {
      await AsyncStorage.setItem(
        consentStorageKey(authUser.id),
        JSON.stringify({
          version: CONSENT_VERSION,
          acceptedAt: new Date().toISOString(),
          faceAnalysis: true,
          location: true,
        }),
      );
      setScreen("home");
    } catch {
      setConsentError(
        "We couldn’t save your agreement. Please try again before continuing.",
      );
    } finally {
      setConsentSaving(false);
    }
  };

  const confirmBooking = async () => {
    if (
      !authToken ||
      !selectedService ||
      !selectedDate ||
      !selectedTime ||
      bookingLoading
    )
      return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const booking = await createBooking(authToken, {
        serviceId: selectedService.id,
        stylistId: selectedStylist?.id,
        joinQueue: Boolean(selectedStylist?.isBusy),
        appointmentAt: `${selectedDate} ${selectedTime}:00`,
        notes: selectedRecommendation
          ? `FaceFit suggested hairstyle: ${selectedRecommendation.name}`
          : undefined,
        context: selectedRecommendation ? {
          hairstyle: selectedRecommendation.name,
          faceShape: faceAnalysis?.faceShape,
          hairLength: hairScalpAnalysis?.hairLength || userProfile?.hairLength,
          hairType: hairScalpAnalysis?.hairType || userProfile?.hairType,
          referenceImage: hairstylePreviewImages[selectedRecommendation.name] || customSuggestionPreviewImages[selectedRecommendation.name] || null,
        } : undefined,
      });
      setLastBookingId(booking.id);
      await loadBookings();
      setScreen("success");
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : "Unable to create booking.",
      );
    } finally {
      setBookingLoading(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate();
  const mondayOffset =
    (new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ).getDay() +
      6) %
    7;
  const calendarDays = [
    ...Array(mondayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const timeOptions = [
    { label: "9:00 AM", value: "09:00" },
    { label: "10:30 AM", value: "10:30" },
    { label: "1:00 PM", value: "13:00" },
    { label: "2:30 PM", value: "14:30" },
    { label: "4:00 PM", value: "16:00" },
    { label: "5:30 PM", value: "17:30" },
  ];
  const isTimePast = (value: string) => {
    if (!selectedDate || selectedDate !== toDateKey(today)) return false;
    const [hours, minutes] = value.split(":").map(Number);
    const slot = new Date();
    slot.setHours(hours, minutes, 0, 0);
    return slot <= new Date();
  };
  const selectedAppointment =
    selectedDate && selectedTime
      ? new Date(`${selectedDate}T${selectedTime}:00`)
      : null;
  const selectedDateLabel =
    selectedAppointment?.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) || "Choose a date";
  const selectedTimeLabel =
    selectedAppointment?.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }) || "Choose a time";

  const chooseAppointmentTime = async (time: string) => {
    if (!selectedDate || !selectedSalon || !selectedService) return;
    const request = ++staffAvailabilityRequest.current;
    const preferredStylistId = selectedStylist?.id;
    setSelectedTime(time);
    setStaffDropdownOpen(false);
    setStaffPickerVisible(!bookedStylistId && !preferredStylistId);
    setStaffPickerLoading(true);
    try {
      const availableStaff = await getSalonStaff(
        selectedSalon.id,
        `${selectedDate} ${time}:00`,
        selectedService.id,
      );
      if (request !== staffAvailabilityRequest.current) return;
      setSalonStaff(availableStaff);
      if (bookedStylistId) {
        const member = availableStaff.find(item => item.id === bookedStylistId);
        if (!member) { setSelectedTime(null); throw new Error('Your chosen stylist is unavailable at this time. Choose a different time or date.'); }
        setSelectedStylist(member);
      } else if (preferredStylistId) {
        const member = availableStaff.find(item => item.id === preferredStylistId);
        if (member) {
          setSelectedStylist(member);
        } else {
          setSelectedStylist(null);
          setStaffPickerVisible(true);
        }
      }
    } catch (error) {
      if (request !== staffAvailabilityRequest.current) return;
      setSelectedTime(null);
      setSalonStaff([]);
      Alert.alert(
        "Unable to check staff",
        error instanceof Error
          ? error.message
          : "Unable to check staff availability.",
      );
    } finally {
      if (request === staffAvailabilityRequest.current) setStaffPickerLoading(false);
    }
  };

  const downloadAppointmentProof = async () => {
    if (!selectedSalon || !selectedService || !selectedAppointment) return;
    const safe = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[character]!,
      );
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{font-family:Arial,sans-serif;color:#29332D;padding:36px}main{max-width:650px;margin:auto;border:1px solid #E2E9E2;border-radius:20px;padding:32px}h1{color:#355C45}.badge{display:inline-block;background:#EDF5EE;color:#355C45;padding:8px 12px;border-radius:99px;font-weight:bold}.row{padding:12px 0;border-bottom:1px solid #E2E9E2}.label{color:#4A765A;font-size:12px;text-transform:uppercase}.value{font-size:17px;font-weight:bold;margin-top:4px}.reference{margin-top:28px;font-size:12px;color:#4A765A}</style></head><body><main><p>hAIrfit APPOINTMENT PROOF</p><h1>Appointment submitted</h1><p class="badge">Pending salon confirmation</p><div class="row"><div class="label">Salon</div><div class="value">${safe(selectedSalon.name)}</div></div><div class="row"><div class="label">Service</div><div class="value">${safe(selectedService.name)}</div></div><div class="row"><div class="label">Date and time</div><div class="value">${safe(selectedDateLabel)} at ${safe(selectedTimeLabel)}</div></div><div class="row"><div class="label">Staff</div><div class="value">${safe(selectedStylist?.name || "Any available professional")}</div></div><div class="row"><div class="label">Estimated price</div><div class="value">PHP ${selectedService.price.toLocaleString()}</div></div><p class="reference">Booking reference: FF-${lastBookingId || "PENDING"} · Present this document to the salon.</p></main></body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS !== "web") {
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            UTI: ".pdf",
            dialogTitle: "Save appointment proof",
          });
        else Alert.alert("Proof created", `Your PDF was saved to ${uri}`);
      }
    } catch (error) {
      Alert.alert(
        "Unable to create proof",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const guestScanStorageKey = "facefit_guest_scan_used_v1";
  const requireGuestLogin = (message = "Log in or create an account to unlock more hairstyle options and booking.") => {
    setAuthError(message);
    setScreen("login");
  };
  const promptGuestAccount = () => {
    requireGuestLogin("Your free guest scan is complete. Log in or create an account to scan again.");
  };
  const startGuestScan = async () => {
    let scanAlreadyUsed = guestScanUsed;
    try {
      scanAlreadyUsed ||= (await AsyncStorage.getItem(guestScanStorageKey)) === "true";
    } catch {
      // The in-memory limit still applies if local storage is unavailable.
    }
    if (scanAlreadyUsed) {
      setGuestScanUsed(true);
      promptGuestAccount();
      return;
    }
    setAuthError(null);
    setIsGuestAccount(true);
    setAuthToken(null);
    setAuthUser(null);
    setFaceAnalysisConsent(true);
    setLocationConsent(true);
    setScreen("scan");
  };

  const processScan = async ({
    uri,
    imageData,
  }: {
    uri: string;
    imageData: string;
  }) => {
    if (isGuestAccount) {
      let scanAlreadyUsed = guestScanUsed;
      try {
        scanAlreadyUsed ||= (await AsyncStorage.getItem(guestScanStorageKey)) === "true";
      } catch {
        // Continue using the in-memory scan limit.
      }
      if (scanAlreadyUsed) {
        setGuestScanUsed(true);
        promptGuestAccount();
        return;
      }
    }
    setUploaded(uri);
    setUploadedImageData(imageData);
    setHairScalpAnalysis(null);
    setCustomHairstylePrompt("");
    setCustomHairstyleSuggestions([]);
    setCustomSuggestionPreviewImages({});
    setCustomSuggestionPreviewLoading({});
    setActiveCustomSuggestionIndex(0);
    setFaceAnalysis(null);
    setSelectedRecommendation(null);
    setHairstylePreviewImages({});
    setHairstylePreviewLoading({});
    setStyleSalonRecords(null);
    setScreen("processing");
    const imageSize = await new Promise<{ width: number; height: number }>((resolve) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({ width: 1, height: 1 }));
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const audience = stylePreference === "women" ? "women" : "men";
    const catalog = hairstyleCatalog[audience].oval as [string, number, string][];
    setFaceAnalysis({
      faceShape: "oval",
      stylePreference,
      confidence: 0.75,
      imageSize,
      landmarks: [
        { x: 0.5, y: 0.27, z: 0 },
        { x: 0.5, y: 0.72, z: 0 },
        { x: 0.29, y: 0.5, z: 0 },
        { x: 0.71, y: 0.5, z: 0 },
        { x: 0.35, y: 0.36, z: 0 },
        { x: 0.65, y: 0.36, z: 0 },
        { x: 0.36, y: 0.64, z: 0 },
        { x: 0.64, y: 0.64, z: 0 },
      ],
      measurements: { lengthToWidth: 1.24, jawToCheek: 0.82, foreheadToCheek: 0.85 },
      recommendations: catalog.slice(0, 5).map(([name, score, reason]) => ({ name, score, reason, audience })),
    });
    setScreen("result");
  };
  const openCurrentLocationMap = async () => {
    if (isGettingLocation) return;
    setIsGettingLocation(true);
    try {
      const permissionResult =
        await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== Location.PermissionStatus.GRANTED) {
        if (!permissionResult.canAskAgain) {
          Alert.alert(
            "Location permission is blocked",
            "Open hAIrfit settings and allow location access to use the nearby map.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open settings",
                onPress: () => void Linking.openSettings(),
              },
            ],
          );
        } else {
          Alert.alert(
            "Location permission needed",
            "Tap View map again and choose Allow while using the app.",
          );
        }
        return;
      }

      let servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled && Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
          servicesEnabled = await Location.hasServicesEnabledAsync();
        } catch {
          // The user can still enable location from the system settings.
        }
      }
      if (!servicesEnabled) {
        Alert.alert(
          "Location is turned off",
          "Turn on device location, then try View map again.",
        );
        return;
      }

      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setMapVisible(true);
    } catch {
      Alert.alert(
        "Unable to open the map",
        "We could not get your current location. Please try again.",
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const auth = (signup = false) => (
    <ScreenFrame>
      <View style={[s.authContent, Platform.OS === "web" && width >= 900 && s.authContentDesktop]}>
      <Header
        title={signup ? "Create account" : "Welcome back"}
        onBack={() => setScreen("onboarding")}
      />
      <View style={s.authIntro}>
        {!signup && <Text style={s.eyebrow}>YOUR BEST LOOK STARTS HERE</Text>}
        {!signup && <Text style={s.title}>Good to see you</Text>}
        <Text style={s.body}>
          Personalized hair, trusted salons, one easy booking.
        </Text>
      </View>
      {signup && (
        <>
          <Text style={s.accountTypeLabel}>
            I&apos;m creating an account as
          </Text>
          <View style={[s.accountTypeRow, Platform.OS === "web" && width < 640 && s.accountTypeRowStacked]}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: accountRole === "customer" }}
              onPress={() => setAccountRole("customer")}
              style={[
                s.accountTypeCard,
                Platform.OS === "web" && width >= 900 && s.accountTypeCardWeb,
                Platform.OS === "web" && width < 640 && s.accountTypeCardCompact,
                accountRole === "customer" && s.accountTypeCardActive,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={24}
                color={accountRole === "customer" ? C.rose : C.muted}
              />
              <Text
                style={[
                  s.accountTypeTitle,
                  accountRole === "customer" && s.accountTypeTitleActive,
                ]}
              >
                Customer
              </Text>
              <Text style={s.accountTypeCaption}>
                Discover styles and book salons
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: accountRole === "owner" }}
              onPress={() => setAccountRole("owner")}
              style={[
                s.accountTypeCard,
                Platform.OS === "web" && width >= 900 && s.accountTypeCardWeb,
                Platform.OS === "web" && width < 640 && s.accountTypeCardCompact,
                accountRole === "owner" && s.accountTypeCardActive,
              ]}
            >
              <Ionicons
                name="storefront-outline"
                size={24}
                color={accountRole === "owner" ? C.rose : C.muted}
              />
              <Text
                style={[
                  s.accountTypeTitle,
                  accountRole === "owner" && s.accountTypeTitleActive,
                ]}
              >
                Business owner
              </Text>
              <Text style={s.accountTypeCaption}>
                Manage a salon and bookings
              </Text>
            </Pressable>
          </View>
        </>
      )}
      {signup && (
        accountRole === "customer" ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.accountTypeLabel}>Gender</Text>
            <Text style={[s.small, { marginBottom: 9 }]}>Used to tailor your hairstyle recommendations.</Text>
            <View style={s.accountTypeRow}>
              {([
                ["men", "Male"],
                ["women", "Female"],
              ] as const).map(([value, label]) => {
                const selected = stylePreference === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setStylePreference(value)}
                    style={[s.accountTypeCard, { minHeight: Platform.OS === "web" && width >= 900 ? 74 : 58, justifyContent: "center" }, selected && s.accountTypeCardActive]}
                  >
                    <Text style={[s.accountTypeTitle, selected && s.accountTypeTitleActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null
      )}
      {signup && (
        <Field
          icon="person-outline"
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
        />
      )}
      <Field
        icon="mail-outline"
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {signup && (
        <Field
          icon="call-outline"
          placeholder="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      )}
      <Field
        icon="lock-closed-outline"
        placeholder="Password (at least 8 characters)"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
      />
      {signup && accountRole === "owner" && (
        <View style={s.ownerSignupSection}>
          <Text style={s.ownerSignupTitle}>Salon information</Text>
          <Text style={s.small}>
            Register your business and pin its exact customer-facing map
            location.
          </Text>
          <Field
            icon="storefront-outline"
            placeholder="Salon name"
            value={salonName}
            onChangeText={setSalonName}
          />
          <Field
            icon="location-outline"
            placeholder="Complete salon address"
            value={salonAddress}
            onChangeText={setSalonAddress}
          />
          <Field
            icon="business-outline"
            placeholder="City or municipality"
            value={salonCity}
            onChangeText={setSalonCity}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void chooseImage("your salon logo").then((photo) => {
                if (photo) {
                  setSalonLogoUri(photo.uri);
                  setSalonLogoData(photo.data);
                }
              })
            }
            style={s.salonSignupLogoPicker}
          >
            {salonLogoUri ? (
              <Image source={{ uri: salonLogoUri }} style={s.salonSignupLogo} />
            ) : (
              <View style={s.salonSignupLogoFallback}>
                <Ionicons name="images-outline" size={27} color={C.rose} />
              </View>
            )}
            <View style={s.salonCardGrow}>
              <Text style={s.cardTitle}>
                {salonLogoUri ? "Change salon logo" : "Add salon logo"}
              </Text>
              <Text style={s.small}>
                Shown on your profile and customer map
              </Text>
            </View>
            <Ionicons name="add-circle" size={24} color={C.rose} />
          </Pressable>
          <Text style={s.accountTypeLabel}>Pin your salon location</Text>
          <SalonLocationPicker
            latitude={Number(salonLatitude) || 14.0667}
            longitude={Number(salonLongitude) || 120.6333}
            onChange={(coordinate) => {
              setSalonLatitude(coordinate.latitude.toFixed(7));
              setSalonLongitude(coordinate.longitude.toFixed(7));
            }}
          />
          <View style={s.coordinateRow}>
            <View style={s.coordinateField}>
              <Field
                icon="navigate-outline"
                placeholder="Latitude"
                value={salonLatitude}
                onChangeText={setSalonLatitude}
                keyboardType="phone-pad"
              />
            </View>
            <View style={s.coordinateField}>
              <Field
                icon="navigate-outline"
                placeholder="Longitude"
                value={salonLongitude}
                onChangeText={setSalonLongitude}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>
      )}
      {authError && (
        <View style={s.authError}>
          <Ionicons name="alert-circle-outline" size={20} color="#355C45" />
          <Text style={s.authErrorText}>{authError}</Text>
        </View>
      )}
      <Button
        label={
          authLoading ? "Please wait…" : signup ? "Create account" : "Log in"
        }
        disabled={authLoading}
        onPress={() => void submitAuth(signup)}
      />
      <Pressable
        onPress={() => {
          setAuthError(null);
          setScreen(signup ? "login" : "signup");
        }}
      >
        <Text style={s.authSwitch}>
          {signup
            ? "Already have an account? Log in"
            : "New here? Create an account"}
        </Text>
      </Pressable>
      {!signup && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void startGuestScan()}
          style={s.guestLoginButton}
        >
          <Ionicons name="scan-outline" size={19} color={C.roseDark} />
          <Text style={s.guestLoginText}>Continue as guest · scan once</Text>
        </Pressable>
      )}
      </View>
    </ScreenFrame>
  );

  const home = (
    <ScreenFrame>
      <CustomerDashboardScreen
        user={authUser}
        salons={salonRecords}
        favoriteSalonIds={favoriteSalonIds}
        savingFavoriteSalonIds={savingFavoriteSalonIds}
        unreadNotifications={notificationUnreadCount}
        loadingSalons={salonsLoading}
        salonsError={salonsError}
        loadingLocation={isGettingLocation}
        onNotifications={() => showNotifications("home")}
        onScan={() => setScreen("scan")}
        onMap={openCurrentLocationMap}
        onReloadSalons={() => void loadSalons()}
        onOpenSalon={(salon) => void openSalon(salon)}
        onToggleFavorite={toggleFavoriteSalon}
      />
    </ScreenFrame>
  );

  const scan = (
    <FaceScanScreen onBack={() => back(isGuestAccount ? "login" : "home")} onCaptured={processScan} />
  );

  const processing = (
    <ScreenFrame scroll={false}>
      <View style={s.centerPage}>
        <View style={s.processIcon}>
          <Ionicons name="scan" size={50} color={C.rose} />
          <ActivityIndicator
            color={C.rose}
            size="large"
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Text style={s.title}>Preparing your scan preview...</Text>
        <Text style={[s.body, s.centerText]}>
          The camera capture works independently; AI analysis is paused for this test.
        </Text>
        <View style={s.steps}>
          {[
            "Photo captured",
            "Preparing placeholder results",
            "Loading sample styles",
            "Almost ready",
          ].map((x, i) => (
            <View style={s.step} key={x}>
              <View style={[s.stepDot, i < 2 && s.stepDone]}>
                {i < 2 && (
                  <Ionicons name="checkmark" size={13} color={C.white} />
                )}
              </View>
              <Text style={s.small}>{x}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );

  const menMatches = (faceAnalysis?.recommendations || []).filter(
    (item) => item.audience === "men",
  );
  const matchSuggestions = (faceAnalysis?.recommendations || []).slice(0, 5);
  const bookResultStylist = async (hairstyle: string, staff: SalonStaff & { salonId: number }) => {
    if (!authToken || isGuestAccount) {
      requireGuestLogin("Log in to book this hairstylist.");
      return;
    }
    const recommendation = faceAnalysis?.recommendations.find(item => item.name === hairstyle)
      || customHairstyleSuggestions.find(item => item.name === hairstyle);
    setSelectedRecommendation(recommendation || null);
    setSelectedSalonHairstyle(hairstyle);
    try {
      const salons = await getSalons();
      const salon = salons.find(item => item.id === staff.salonId);
      if (!salon) throw new Error('This salon is no longer available.');
      await openSalon(salon, 'salons', staff, hairstyle);
    } catch (error) {
      Alert.alert('Unable to open salon', error instanceof Error ? error.message : 'Please try again.');
    }
  };
  const matchCardWidth = Math.min(Math.max(width - 48, 280), 560);
  useEffect(() => {
    setActiveHairstyleIndex(0);
  }, [screen, faceAnalysis, uploadedImageData]);
  const recommendationCard = (
  item: FaceAnalysis["recommendations"][number],
  ) => (
    <Pressable 
      onPress={() => { 
        setSelectedRecommendation(item); 
        setScreen("style-detail"); 
        setAiPreviewImage(null);
      }} 
      style={s.recCard} 
      key={`${item.audience}-${item.name}`}
    >
      <View style={s.matchBadge}>
        <Text style={s.matchText}>{item.score}% match</Text>
      </View>
      <View style={s.recBody}>
        <View style={s.sectionHead}>
          <Text style={s.cardTitle}>{item.name}</Text>
          <Ionicons name="chevron-forward" size={20} color={C.rose} />
        </View>
        <Text style={s.small}>{item.reason}</Text>
      </View>
    </Pressable>
  );

  const result = faceAnalysis ? (
    <ScreenFrame>
      <Header
        title="Your result"
        onBack={() => setScreen(isGuestAccount ? "login" : "home")}
        action="share-outline"
      />
      <View style={s.resultContent}>
      <View pointerEvents="none" style={s.resultDecorLayer}>
        <View style={s.resultDecorLeft} />
        <View style={s.resultDecorRight} />
        <View style={s.resultDecorAccent} />
        <Ionicons name="leaf-outline" size={46} color="#6F9F7D" style={s.resultDecorLeaf} />
        <Ionicons name="sparkles-outline" size={25} color="#6F9F7D" style={s.resultDecorSparkle} />
      </View>
      <Text style={s.eyebrow}>LOCAL TEST PREVIEW - PLACEHOLDER</Text>
      <Text style={s.display}>
        {faceAnalysis.faceShape.charAt(0).toUpperCase() +
          faceAnalysis.faceShape.slice(1)}
      </Text>
      <View style={[s.resultVisual, uploaded && {
        width: Math.min(720, Math.max(240, width - 80), 520 * (faceAnalysis.imageSize.width / faceAnalysis.imageSize.height)),
        height: Math.min(720, Math.max(240, width - 80), 520 * (faceAnalysis.imageSize.width / faceAnalysis.imageSize.height)) / (faceAnalysis.imageSize.width / faceAnalysis.imageSize.height),
        alignSelf: "center",
      }]}>
        {uploaded ? (
          <FaceLandmarkOverlay
            uri={uploaded}
            imageSize={faceAnalysis.imageSize}
            landmarks={faceAnalysis.landmarks}
          />
        ) : (
          <Art height={230} quadrant={0} />
        )}
      </View>
      <Text style={s.sectionTitle}>
        {shapeCopy[faceAnalysis.faceShape].title}
      </Text>
      <Text style={s.body}>
        {shapeCopy[faceAnalysis.faceShape].description} This is a local test result; the face shape, points, measurements, and styles are placeholders.
      </Text>
      <Text style={s.eyebrow}>SCAN MEASUREMENTS</Text>
      <View style={s.chipRow}>
        <View style={s.chip}>
          <Text style={s.chipText}>
            Length {faceAnalysis.measurements.lengthToWidth.toFixed(2)}× width
          </Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipText}>
            Jaw {faceAnalysis.measurements.jawToCheek.toFixed(2)}× cheeks
          </Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipText}>
            Forehead {faceAnalysis.measurements.foreheadToCheek.toFixed(2)}×
            cheeks
          </Text>
        </View>
      </View>
      <Text style={s.sectionTitle}>Hair analysis</Text>
      <Text style={s.body}>Get general care observations based on what is visible in your photo.</Text>
      <Button
        label={isGuestAccount ? "Log in to unlock hair analysis" : "Analyze hair"}
        disabled={isAnalyzingHairScalp || !uploadedImageData}
        onPress={() => void handleAnalyzeHairScalp()}
        icon={isGuestAccount ? "lock-closed" : "sparkles"}
      />
      <Modal transparent animationType="fade" visible={isHairScalpModalVisible} onRequestClose={() => setIsHairScalpModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(20, 34, 17, 0.62)", justifyContent: "center", alignItems: "center", padding: 18 }}>
          <View style={{ width: "100%", maxWidth: 520, maxHeight: "88%", borderRadius: 28, backgroundColor: C.pale, padding: 20, paddingTop: 20, borderWidth: 1, borderColor: C.line }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close hair analysis" hitSlop={10} onPress={() => setIsHairScalpModalVisible(false)} style={{ position: "absolute", top: 16, right: 16, zIndex: 1, width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={22} color={C.roseDark} />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingRight: 48, marginBottom: 20 }}>
                <View style={{ width: 50, height: 50, borderRadius: 17, backgroundColor: C.blush, alignItems: "center", justifyContent: "center" }}><Ionicons name="leaf-outline" size={25} color={C.rose} /></View>
                <View style={{ flex: 1 }}><Text style={[s.eyebrow, { marginBottom: 4 }]}>PERSONAL CARE</Text><Text style={{ fontSize: 23, lineHeight: 29, fontWeight: "900", color: C.ink }}>Hair analysis</Text><Text style={{ color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 3 }}>A few observations from your photo</Text></View>
              </View>
              {isAnalyzingHairScalp ? (
                <View style={{ paddingVertical: 38, alignItems: "center", backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line }}>
                  <ActivityIndicator size="large" color={C.rose} />
                  <Text style={{ marginTop: 14, color: C.ink, fontWeight: "700", fontSize: 15 }}>Analyzing your photo…</Text>
                  <Text style={{ marginTop: 5, color: C.muted, fontSize: 13 }}>This usually takes a few seconds.</Text>
                </View>
              ) : hairScalpAnalysis ? (
                <>
                  <View style={{ flexDirection: "row", gap: 9, marginBottom: 20 }}>
                    {([ ["HAIR TYPE", hairScalpAnalysis.hairType], ["LENGTH", hairScalpAnalysis.hairLength], ["TEXTURE", hairScalpAnalysis.hairTexture] ] as const).map(([label, value]) => (
                      <View key={label} style={{ flex: 1, minHeight: 88, borderRadius: 17, padding: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, justifyContent: "center" }}>
                        <Text style={{ color: C.rose, fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 0.7 }}>{label}</Text>
                        <Text style={{ color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: "800", marginTop: 7 }}>{value}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 11 }}>
                    <Ionicons name="sparkles" size={18} color={C.rose} />
                    <Text style={{ color: C.ink, fontSize: 17, fontWeight: "900" }}>Care tips</Text>
                  </View>
                  <View style={{ gap: 10 }}>
                    {hairScalpAnalysis.careTips.map((tip, index) => (
                      <View key={`${index}-${tip}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 17, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
                        <View style={{ width: 27, height: 27, borderRadius: 10, backgroundColor: C.blush, alignItems: "center", justifyContent: "center", marginTop: 1 }}><Text style={{ color: C.roseDark, fontSize: 12, fontWeight: "900" }}>{index + 1}</Text></View>
                        <Text style={{ flex: 1, color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: "500" }}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 16, paddingHorizontal: 2 }}>{hairScalpAnalysis.disclaimer}</Text>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <View style={s.resultMatchesHeader}>
        <View style={s.resultMatchesIcon}><Ionicons name="sparkles" size={22} color={C.rose} /></View>
        <View style={s.salonCardGrow}><Text style={s.sectionTitle}>Your hairstyle matches</Text><Text style={s.small}>Ranked for your {faceAnalysis.faceShape} face, detected proportions, and {hairScalpAnalysis?.hairLength || userProfile?.hairLength || "preferred"} hair length.</Text></View>
      </View>
      {matchSuggestions.length > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={matchCardWidth}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.min(
                matchSuggestions.length - 1,
                Math.max(0, Math.round(event.nativeEvent.contentOffset.x / matchCardWidth)),
              );
              setActiveHairstyleIndex(nextIndex);
            }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {matchSuggestions.map((item, index) => {
              const preview = hairstylePreviewImages[item.name];
              const isLoadingPreview = hairstylePreviewLoading[item.name];
              return (
                <View key={`${item.audience}-${item.name}`} style={{ width: matchCardWidth, paddingRight: 12 }}>
                  <View style={{ borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, overflow: "hidden" }}>
                    <View style={{ width: "100%", aspectRatio: 1, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
                      {preview ? (
                        <Image source={{ uri: preview }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                      ) : isLoadingPreview ? (
                        <View style={{ alignItems: "center", padding: 20 }}>
                          <ActivityIndicator size="large" color={C.rose} />
                          <Text style={[s.small, { marginTop: 12 }]}>Creating your hairstyle preview…</Text>
                        </View>
                      ) : (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Generate preview for ${item.name}`} onPress={() => void generateMatchPreview(item)} style={{ width: "100%", height: "100%" }}>
                          {uploaded && <Image source={{ uri: uploaded }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />}
                          <View style={{ position: "absolute", bottom: 12, alignSelf: "center", backgroundColor: C.white, borderRadius: 12, padding: 10 }}>
                            <Text style={s.matchText}>Tap to generate preview</Text>
                            <Text style={s.small}>Original photo</Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ padding: 16 }}>
                      <View style={s.sectionHead}>
                        <Text style={s.cardTitle}>{item.name}</Text>
                        <Text style={s.small}>{index + 1} of {matchSuggestions.length}</Text>
                      </View>
                      <View style={{ alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: C.blush }}>
                        <Text style={[s.matchText, { fontSize: 11 }]}>{item.score}% match</Text>
                      </View>
                      <Text style={[s.small, { marginTop: 6 }]}>{item.reason}</Text>
                      <HairstyleStylists hairstyle={item.name} onSelect={staff => void bookResultStylist(item.name, staff)} />
                      <Pressable accessibilityRole="button" onPress={() => { setSelectedRecommendation(item); setAiPreviewImage(preview || null); setScreen("style-detail"); }} style={{ marginTop: 16 }}>
                        <Text style={s.matchText}>View style details ›</Text>
                      </Pressable>
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                        <Pressable accessibilityRole="button" onPress={() => saveHairstyleForCustomer(item.name)} style={{ flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: C.blush, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Ionicons name="heart" size={17} color={C.roseDark} /><Text style={[s.matchText, { fontSize: 12 }]}>Save hairstyle</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => void findSalonsForStyle(item.name)} style={{ flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: C.rose, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Ionicons name="location" size={17} color={C.white} /><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>Find salon</Text></Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 10, marginBottom: 8 }}>
            {matchSuggestions.map((item, index) => (
              <View key={item.name} style={{ width: index === activeHairstyleIndex ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: index === activeHairstyleIndex ? C.rose : C.line }} />
            ))}
          </View>
          <Text style={[s.small, { textAlign: "center", marginBottom: 14 }]}>Swipe to browse each match. Previews only generate when requested.</Text>
        </>
      ) : (
        <Text style={s.small}>No hairstyle matches are available for this scan yet.</Text>
      )}
      <Text style={s.sectionTitle}>Describe your hairstyle</Text>
      <Text style={s.body}>{isGuestAccount ? "Create an account to unlock custom AI hairstyle suggestions." : "Tell us what you want to change. AI will suggest styles that fit your request and face shape."}</Text>
      {isGuestAccount ? <Button label="Log in to unlock AI prompt" onPress={() => setScreen("login")} icon="lock-closed" /> : <>
      <TextInput
        accessibilityLabel="Describe the hairstyle you want"
        value={customHairstylePrompt}
        onChangeText={setCustomHairstylePrompt}
        placeholder="Example: a short textured cut with a low fade"
        placeholderTextColor="#4A765A"
        multiline
        maxLength={300}
        textAlignVertical="top"
        style={{ width: "100%", minHeight: 92, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, color: C.ink, marginVertical: 10 }}
      />
      {customHairstylePrompt.trim().length > 0 && !isValidHairstylePrompt(customHairstylePrompt) && <Text style={[s.small, { color: C.roseDark, marginBottom: 10 }]}>Include a hairstyle or cut and a detail. For example: “a textured bob for thick hair”. Random text and single words cannot generate suggestions.</Text>}
      <Button
        label={isSuggestingHairstyles ? "Finding styles..." : "Suggest hairstyles"}
        disabled={!isValidHairstylePrompt(customHairstylePrompt) || isSuggestingHairstyles}
        onPress={() => void handleRequestHairstyleSuggestions()}
        icon="sparkles"
      />
      </>}
      {customHairstyleSuggestions.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Previews for your request</Text>
          <Text style={[s.small, { marginBottom: 10 }]}>Swipe through your suggested styles. Tap Generate preview for a style you want to try.</Text>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={matchCardWidth}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.min(
                customHairstyleSuggestions.length - 1,
                Math.max(0, Math.round(event.nativeEvent.contentOffset.x / matchCardWidth)),
              );
              setActiveCustomSuggestionIndex(nextIndex);
            }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {customHairstyleSuggestions.map((item, index) => {
              const preview = customSuggestionPreviewImages[item.name];
              const isLoadingPreview = customSuggestionPreviewLoading[item.name];
              return (
                <View key={`${item.audience}-${item.name}`} style={{ width: matchCardWidth, paddingRight: 12 }}>
                  <View style={{ borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, overflow: "hidden" }}>
                    <View style={{ width: "100%", aspectRatio: 1, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
                      {preview ? (
                        <Image source={{ uri: preview }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                      ) : isLoadingPreview ? (
                        <View style={{ alignItems: "center", padding: 20 }}>
                          <ActivityIndicator size="large" color={C.rose} />
                          <Text style={[s.small, { marginTop: 12 }]}>Creating your hairstyle preview…</Text>
                        </View>
                      ) : (
                        <View style={{ alignItems: "center", padding: 20 }}>
                          <Ionicons name="camera-outline" size={34} color={C.rose} />
                          <Text style={[s.small, { marginTop: 8, textAlign: "center", marginBottom: 12 }]}>Automatic previews are paused. Generate this style when you are ready.</Text>
                          <Button label="Generate preview" onPress={() => void generateCustomSuggestionPreview(item)} icon="sparkles" />
                        </View>
                      )}
                    </View>
                    <View style={{ padding: 16 }}>
                      <View style={s.sectionHead}>
                        <Text style={s.cardTitle}>{item.name}</Text>
                        <Text style={s.small}>{index + 1} of {customHairstyleSuggestions.length}</Text>
                      </View>
                      <View style={{ alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: C.blush }}>
                        <Text style={[s.matchText, { fontSize: 11 }]}>{item.score}% match</Text>
                      </View>
                      <Text style={[s.small, { marginTop: 6 }]}>{item.reason}</Text>
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                        <View style={{ flex: 1 }}><HairstyleStylists hairstyle={item.name} onSelect={staff => void bookResultStylist(item.name, staff)} /></View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                        <Pressable accessibilityRole="button" onPress={() => saveHairstyleForCustomer(item.name)} style={{ flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: C.blush, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Ionicons name="heart" size={17} color={C.roseDark} /><Text style={[s.matchText, { fontSize: 12 }]}>Save hairstyle</Text></Pressable>
                        <Pressable accessibilityRole="button" onPress={() => { if (!authToken) { setScreen("login"); return; } void findSalonsForStyle(item.name); }} style={{ flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: C.rose, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Ionicons name="location" size={17} color={C.white} /><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>Find salon</Text></Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 10, marginBottom: 8 }}>
            {customHairstyleSuggestions.map((item, index) => (
              <View key={item.name} style={{ width: index === activeCustomSuggestionIndex ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: index === activeCustomSuggestionIndex ? C.rose : C.line }} />
            ))}
          </View>
          <Text style={[s.small, { textAlign: "center", marginBottom: 14 }]}>Swipe to browse each suggestion. Previews only generate when requested.</Text>
        </>
      )}
      <Button
        label="Scan again"
        onPress={() => {
          if (isGuestAccount && guestScanUsed) promptGuestAccount();
          else setScreen("scan");
        }}
        secondary
      />
      </View>
    </ScreenFrame>
  ) : (
    processing
  );

  const recommendations = (
    <ScreenFrame>
      <Header title="Men's top matches" onBack={() => setScreen("result")} action="heart-outline" />
      <Text style={s.body}>
        Men&apos;s hairstyles ranked for your {faceAnalysis?.faceShape || "detected"} face shape, facial proportions, and hair length.
      </Text>
      <View style={s.chatBox}>
        <Ionicons name="sparkles" size={19} color={C.rose} />
        <TextInput style={s.chatInput} placeholder="Refine: shorter, curly, low-maintenance…" placeholderTextColor="#4A765A" />
        <Ionicons name="arrow-up-circle" size={27} color={C.rose} />
      </View>
      <Text style={s.matchSectionTitle}>Recommended for you</Text>
      <Text style={s.matchSectionCopy}>Shapes and finishes selected for your facial structure.</Text>
      {menMatches.map(recommendationCard)}
    </ScreenFrame>
  );

  const styleDetail = selectedRecommendation ? (
    <ScreenFrame>
      <Header title="Style details" onBack={() => setScreen("recommendations")} action="heart-outline" />
      <View style={s.detailTitle}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{selectedRecommendation.audience === "men" ? "MEN'S STYLE" : "WOMEN'S STYLE"}</Text>
          <Text style={s.title}>{selectedRecommendation.name}</Text>
          <Text style={s.matchText}>{selectedRecommendation.score}% match for you</Text>
        </View>
        <View style={s.scoreCircle}><Text style={s.scoreText}>{selectedRecommendation.score}</Text></View>
      </View>
      <View style={{ width: "100%", height: 280, borderRadius: 20, backgroundColor: C.blush, marginVertical: 15, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {isGeneratingAi ? (
          <View style={{ alignItems: "center" }}><ActivityIndicator size="large" color={C.rose} /><Text style={{ marginTop: 10, color: C.roseDark, fontWeight: "700" }}>Generating AI Hairstyle...</Text></View>
        ) : aiPreviewImage ? (
          <Image source={{ uri: aiPreviewImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: "center", padding: 20 }}>
            <Text style={[s.small, { textAlign: "center", marginBottom: 12 }]}>Automatic previews are paused.</Text>
            <Button label="Generate preview" onPress={() => void handleGenerateAiPreview()} icon="sparkles" />
          </View>
        )}
      </View>
      <Text style={s.sectionTitle}>Why it suits you</Text>
      <Text style={s.body}>{selectedRecommendation.reason}</Text>
      <HairstyleStylists hairstyle={selectedRecommendation.name} onSelect={staff => void bookResultStylist(selectedRecommendation.name, staff)} />
      <Button
        label="Save hairstyle"
        onPress={() => saveHairstyleForCustomer(selectedRecommendation.name)}
        icon="heart"
      />
      <Button label="Find a salon for this style" onPress={() => void findSalonsForStyle(selectedRecommendation.name)} icon="location" />
    </ScreenFrame>
  ) : (
    recommendations
  );

  const normalizedSalonSearch = salonSearchQuery.trim().toLowerCase();
  const availableSalonRecords = styleSalonRecords ?? salonRecords;
  const filteredSalonRecords = availableSalonRecords.filter((salon) => {
    const matchesSearch =
      !normalizedSalonSearch ||
      [salon.name, salon.address, salon.city, salon.phone].some((value) =>
        value?.toLowerCase().includes(normalizedSalonSearch),
      );
    const hasVerifiedHours = Boolean(salon.opening_time && salon.closing_time);
    return (
      matchesSearch &&
      (!showOpenSalonsOnly || (hasVerifiedHours && isSalonOpenNow(salon)))
    );
  });
  const mappedSalons = salonRecords.flatMap((salon) =>
    salon.latitude != null && salon.longitude != null
      ? [
          {
            id: salon.id,
            name: salon.name,
            address: salon.address,
            latitude: salon.latitude,
            longitude: salon.longitude,
            profileImageUrl: getApiAssetUrl(salon.profileImageUrl),
          },
        ]
      : [],
  );
  const filteredMappedSalons = filteredSalonRecords.flatMap((salon) =>
    salon.latitude != null && salon.longitude != null
      ? [
          {
            id: salon.id,
            name: salon.name,
            address: salon.address,
            latitude: salon.latitude,
            longitude: salon.longitude,
            profileImageUrl: getApiAssetUrl(salon.profileImageUrl),
          },
        ]
      : [],
  );
  const salons = (
    <ScreenFrame>
      <Header
        title="Find salons"
        onBack={() => setScreen("home")}
        action="options-outline"
      />
      <View
        style={[
          s.salonListingHero,
          width < 600 && s.salonListingHeroCompact,
        ]}
      >
        <Image
          accessibilityLabel="Warm, modern salon interior"
          source={salonListingCover}
          resizeMode="cover"
          style={s.salonListingHeroImage}
        />
        <View style={s.salonListingHeroShade} />
        <View style={s.salonListingHeroContent}>
          <View style={s.salonLocationPill}>
            <Ionicons name="location" size={14} color="#FFFFFF" />
            <Text style={s.salonLocationText}>Nasugbu, Batangas</Text>
          </View>
          <Text style={s.salonListingHeroTitle}>Nasugbu Salons</Text>
          <Text style={s.salonListingHeroSubtitle}>
            Find the best salons near you with FACE-FIT.
          </Text>
        </View>
      </View>
      <View style={s.salonSearch}>
        <Ionicons name="search" size={20} color="#315E45" />
        <TextInput
          accessibilityLabel="Search Nasugbu salons"
          value={salonSearchQuery}
          onChangeText={setSalonSearchQuery}
          placeholder="Search salon, address, or city..."
          placeholderTextColor="#718078"
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={s.salonSearchInput}
        />
        {salonSearchQuery.length > 0 && Platform.OS !== "ios" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear salon search"
            hitSlop={8}
            onPress={() => setSalonSearchQuery("")}
            style={({ pressed }) => [s.searchClear, pressed && s.pressed]}
          >
            <Ionicons name="close-circle" size={20} color={C.muted} />
          </Pressable>
        )}
      </View>
      {selectedSalonHairstyle && (
        <View style={{ paddingHorizontal: 4, paddingBottom: 12 }}>
          <Text style={s.cardTitle}>Salons for {selectedSalonHairstyle}</Text>
          <Text style={s.small}>
            {salonsLoading
              ? "Finding Nasugbu salons…"
              : styleSalonRecords?.[0]?.hairstyleMatchType === "general"
                ? "These salons list haircut services. Contact them to confirm they can do this exact style."
                : "These salons are listed for this style. Contact them to confirm current services and availability."}
          </Text>
        </View>
      )}
      <View style={s.salonControlsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: showOpenSalonsOnly }}
          onPress={() => setShowOpenSalonsOnly((current) => !current)}
          style={({ pressed }) => [
            s.salonFilterButton,
            showOpenSalonsOnly && s.salonFilterButtonActive,
            pressed && s.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={17}
            color={showOpenSalonsOnly ? "#FFFFFF" : "#315E45"}
          />
          <Text
            style={[
              s.salonFilterButtonText,
              showOpenSalonsOnly && s.salonFilterButtonTextActive,
            ]}
          >
            {showOpenSalonsOnly ? "Open now" : "Filter"}
          </Text>
        </Pressable>
        <View style={s.salonViewToggle}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: salonView === "list" }}
            onPress={() => setSalonView("list")}
            style={salonView === "list" ? s.salonViewActive : s.salonViewItem}
          >
            <Ionicons
              name="list"
              size={16}
              color={salonView === "list" ? "#164E35" : "#718078"}
            />
            <Text
              style={
                salonView === "list"
                  ? s.salonViewActiveText
                  : s.salonViewItemText
              }
            >
              List
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: salonView === "map" }}
            onPress={() => setSalonView("map")}
            style={salonView === "map" ? s.salonViewActive : s.salonViewItem}
          >
            <Ionicons
              name="map-outline"
              size={16}
              color={salonView === "map" ? "#164E35" : "#718078"}
            />
            <Text
              style={
                salonView === "map"
                  ? s.salonViewActiveText
                  : s.salonViewItemText
              }
            >
              Map
            </Text>
          </Pressable>
        </View>
      </View>
      <Text style={s.salonResultCount}>
        {filteredSalonRecords.length} salon
        {filteredSalonRecords.length === 1 ? "" : "s"} found
      </Text>
      {salonsLoading ? (
        <ActivityIndicator color={C.rose} style={s.dataLoader} />
      ) : salonsError ? (
        <Pressable onPress={loadSalons} style={s.dataState}>
          <Text style={s.cardTitle}>Unable to reach the hAIrfit service</Text>
          <Text style={s.small}>{salonsError} · Tap to retry</Text>
        </Pressable>
      ) : filteredSalonRecords.length === 0 ? (
        <View style={s.dataState}>
          <Ionicons name="search-outline" size={30} color={C.rose} />
          <Text style={s.cardTitle}>
            {normalizedSalonSearch
              ? "No matching salons"
              : showOpenSalonsOnly
                ? "No salons with verified hours are open right now"
                : "No salons found"}
          </Text>
          <Text style={s.small}>
            {normalizedSalonSearch
              ? `Try another search for “${salonSearchQuery.trim()}”.`
              : showOpenSalonsOnly
                ? "Turn off the Open now filter to see all salons."
                : "Run npm run db:init in the server directory."}
          </Text>
          {normalizedSalonSearch && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSalonSearchQuery("")}
              style={s.clearSearchButton}
            >
              <Text style={s.link}>Clear search</Text>
            </Pressable>
          )}
        </View>
      ) : salonView === "map" ? (
        <>
          <SalonMap
            salons={filteredMappedSalons}
            onSelectSalon={(salonId) => {
              const salon = filteredSalonRecords.find(
                (item) => item.id === salonId,
              );
              if (salon) void openSalon(salon);
            }}
          />
          {filteredMappedSalons.length === 0 && (
            <View style={s.mapNotice}>
              <Ionicons name="location-outline" size={21} color={C.rose} />
              <Text style={s.small}>
                The matching salons do not have verified map coordinates yet.
              </Text>
            </View>
          )}
          <Text style={s.mapAttribution}>
            Showing {filteredSalonRecords.length} salon
            {filteredSalonRecords.length === 1 ? "" : "s"} · Map data ©
            OpenStreetMap contributors
          </Text>
        </>
      ) : (
        filteredSalonRecords.map((salon) => {
          const favorite = favoriteSalonIds.includes(salon.id);
          const busy = savingFavoriteSalonIds.includes(salon.id);
          const open = isSalonOpenNow(salon);
          return (
            <Pressable
              key={salon.id}
              accessibilityHint={open ? undefined : "Closed now. You can still book a future appointment."}
              onPress={() => void openSalon(salon)}
              style={({ pressed }) => [
                s.salonDiscoveryCard,
                !open && s.listCardClosed,
                pressed && s.salonCardPressed,
              ]}
            >
              <View
                style={[
                  s.salonDiscoveryImage,
                  width < 600 && s.salonDiscoveryImageCompact,
                  !open && s.salonClosedDim,
                ]}
              >
                {salon.profileImageUrl ? (
                  <Image
                    accessibilityLabel={`${salon.name} profile picture`}
                    source={{ uri: getApiAssetUrl(salon.profileImageUrl)! }}
                    resizeMode="cover"
                    style={s.salonSquareImage}
                  />
                ) : (
                  <Ionicons name="storefront-outline" size={28} color="#315E45" />
                )}
              </View>
              <View style={[s.salonDiscoveryInfo, !open && s.salonClosedDim]}>
                <Text numberOfLines={1} style={s.salonDiscoveryName}>
                  {salon.name}
                </Text>
                <View style={s.salonDiscoveryMeta}>
                  <Ionicons name="location-outline" size={14} color="#718078" />
                  <Text numberOfLines={1} style={s.salonDiscoveryMetaText}>
                    {salon.address?.trim() || salon.city?.trim() || "N/A"}
                  </Text>
                </View>
                <View style={s.salonDiscoveryMeta}>
                  <Ionicons
                    name="call-outline"
                    size={13}
                    color="#718078"
                  />
                  <Text numberOfLines={1} style={s.salonDiscoveryMetaText}>
                    {salon.phone?.trim() || "N/A"}
                  </Text>
                </View>
                <View style={s.salonDiscoveryBadges}>
                  {salon.reviewCount !== undefined &&
                    salon.reviewCount > 0 &&
                    salon.rating > 0 && (
                      <View style={s.salonRatingBadge}>
                        <Ionicons name="star" size={13} color="#B27A32" />
                        <Text style={s.salonRatingText}>
                          {Number(salon.rating).toFixed(1)}
                        </Text>
                        <Text style={s.salonReviewCountText}>
                          ({salon.reviewCount})
                        </Text>
                      </View>
                    )}
                  {salon.opening_time && salon.closing_time && (
                    <View
                      style={[
                        s.salonStatusBadge,
                        open ? s.salonStatusOpen : s.salonStatusClosed,
                      ]}
                    >
                      <View
                        style={[
                          s.salonStatusDot,
                          open ? s.salonStatusDotOpen : s.salonStatusDotClosed,
                        ]}
                      />
                      <Text
                        style={[
                          s.salonStatusText,
                          !open && s.salonStatusTextClosed,
                        ]}
                        numberOfLines={1}
                      >
                        {salonStatusText(salon)}
                      </Text>
                    </View>
                  )}
                  {(salon.latitude == null || salon.longitude == null) && (
                    <View style={s.salonNoMapBadge}>
                      <Ionicons name="location-outline" size={12} color="#718078" />
                      <Text style={s.salonNoMapText}>Not mapped</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={(event) => {
                    event.stopPropagation();
                    void openSalon(salon);
                  }}
                  style={s.salonDetailsLink}
                >
                  <Text style={s.salonDetailsLinkText}>View details</Text>
                  <Ionicons name="arrow-forward" size={14} color="#164E35" />
                </Pressable>
              </View>
              <View style={s.salonDiscoveryActions}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: favorite, busy }}
                  accessibilityLabel={`${favorite ? "Remove" : "Add"} ${salon.name} ${favorite ? "from" : "to"} favorites`}
                  hitSlop={8}
                  onPress={(event) => {
                    event.stopPropagation();
                    toggleFavoriteSalon(salon.id);
                  }}
                  style={({ pressed }) => [
                    s.listFavorite,
                    favorite && s.favoriteButtonActive,
                    pressed && s.favoritePressed,
                  ]}
                >
                  <FavoriteIcon active={favorite} busy={busy} />
                </Pressable>
                {width >= 600 && (
                  <Ionicons name="chevron-forward" size={18} color="#819087" />
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </ScreenFrame>
  );

  const salonDetailFavorite = selectedSalon
    ? favoriteSalonIds.includes(selectedSalon.id)
    : false;
  const salonDetailFavoriteBusy = selectedSalon
    ? savingFavoriteSalonIds.includes(selectedSalon.id)
    : false;
  const salonHours = selectedSalon?.opening_time
    ? `${selectedSalon.opening_time.slice(0, 5)}${selectedSalon.closing_time ? `–${selectedSalon.closing_time.slice(0, 5)}` : ""}`
    : "Contact for hours";
  const suggestedStyleService = selectedRecommendation
    ? salonServices.find(
        (service) => service.name === "Premium Style Haircut",
      ) ||
      salonServices.find((service) =>
        /haircut|hair cut|style|cut/i.test(service.name),
      ) ||
      salonServices[0]
    : undefined;
  const salonDetail = (
    <ScreenFrame>
      <Header
        title="Salon profile"
        onBack={() => {
          if (salonDetailReturn === "nearby-map") {
            setScreen("home");
            setMapVisible(true);
          } else {
            setScreen(salonDetailReturn);
          }
        }}
        action="heart-outline"
        favoriteActive={salonDetailFavorite}
        actionBusy={salonDetailFavoriteBusy}
        actionColor={C.rose}
        onAction={
          selectedSalon
            ? () => toggleFavoriteSalon(selectedSalon.id)
            : undefined
        }
      />
      {selectedSalon ? (
        <>
          {selectedRecommendation && faceAnalysis && (
            <View style={s.notice}>
              <Ionicons name="sparkles" size={21} color={C.rose} />
              <View style={s.salonCardGrow}>
                <Text style={s.cardTitle}>
                  Your suggested look: {selectedRecommendation.name}
                </Text>
                <Text style={s.small}>
                  {selectedRecommendation.score}% match for your{" "}
                  {faceAnalysis.faceShape} face shape. Show this recommendation
                  to your stylist.
                </Text>
              </View>
            </View>
          )}
          <View style={s.salonProfileHero}>
            <SalonLogo
              name={selectedSalon.name}
              imageUrl={selectedSalon.profileImageUrl}
              large
            />
            <View style={s.salonHeroContent}>
              <Text style={s.salonProfileName}>{selectedSalon.name}</Text>
              <View style={s.salonRatingRow}>
                <Ionicons name="star" size={17} color="#6F946E" />
                <Text style={s.salonRatingText}>
                  {salonReviewSummary.count
                    ? salonReviewSummary.average.toFixed(1)
                    : "New"}
                </Text>
                <Text style={s.salonHeroMeta}>
                  {salonReviewSummary.count
                    ? `${salonReviewSummary.count} review${salonReviewSummary.count === 1 ? "" : "s"}`
                    : "Be the first to review"}
                </Text>
              </View>
              <Text style={s.salonHeroAddress}>
                {selectedSalon.address} · {selectedSalon.city}
              </Text>
            </View>
          </View>
          <View style={s.salonInfoGrid}>
            <View style={s.salonInfoCard}>
              <Ionicons name="time-outline" size={21} color={C.rose} />
              <Text style={s.salonInfoLabel}>Hours</Text>
              <Text style={s.salonInfoValue}>{salonHours}</Text>
            </View>
            <View style={s.salonInfoCard}>
              <Ionicons name="call-outline" size={21} color={C.rose} />
              <Text style={s.salonInfoLabel}>Contact</Text>
              <Text numberOfLines={1} style={s.salonInfoValue}>
                {selectedSalon.phone || "Not published"}
              </Text>
            </View>
            <View style={s.salonInfoCard}>
              <Ionicons name="people-outline" size={21} color={C.rose} />
              <Text style={s.salonInfoLabel}>Available staff</Text>
              <Text style={s.salonInfoValue}>{salonStaff.length}</Text>
            </View>
          </View>
          {selectedSalon.description && (
            <View style={s.salonAbout}>
              <Text style={s.salonSectionKicker}>ABOUT</Text>
              <Text style={s.body}>{selectedSalon.description}</Text>
            </View>
          )}
          {salonDetailError && (
            <Pressable
              onPress={() => void openSalon(selectedSalon, salonDetailReturn)}
              style={s.salonLoadWarning}
            >
              <Ionicons name="refresh-circle" size={22} color={C.rose} />
              <Text style={s.authErrorText}>{salonDetailError}</Text>
            </Pressable>
          )}
          {salonDetailLoading ? (
            <ActivityIndicator color={C.rose} style={s.dataLoader} />
          ) : (
            <>
              {salonDetailTab === 'Services' && salonPortfolioImages.length > 0 && (
                <>
                  <SectionTitle title="Business portfolio" />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.portfolioGallery}
                  >
                    {salonPortfolioImages.map((image) => (
                      <View style={s.portfolioCustomerCard} key={image.id}>
                        <Image
                          source={{ uri: getApiAssetUrl(image.imageUrl)! }}
                          style={s.portfolioCustomerImage}
                        />
                        {image.caption && (
                          <Text numberOfLines={2} style={s.portfolioCaption}>
                            {image.caption}
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
              {salonDetailTab === 'Services' && <><SectionTitle title="Services & pricing" />
              {selectedRecommendation && suggestedStyleService && (
                <Pressable
                  onPress={() => {
                    setSelectedService(suggestedStyleService);
                    setScreen("datetime");
                  }}
                  style={({ pressed }) => [
                    s.salonServiceCard,
                    s.choiceSelected,
                    pressed && s.pressed,
                  ]}
                >
                  <View style={s.salonServiceIcon}>
                    <Ionicons name="sparkles" size={22} color={C.rose} />
                  </View>
                  <View style={s.salonCardGrow}>
                    <Text style={s.eyebrow}>YOUR hAIrfit SUGGESTION</Text>
                    <Text style={s.cardTitle}>
                      {selectedRecommendation.name}
                    </Text>
                    <Text numberOfLines={2} style={s.small}>
                      {selectedRecommendation.reason}
                    </Text>
                    <Text style={s.small}>
                      Provided under {suggestedStyleService.name}
                    </Text>
                    <View style={s.salonServiceMeta}>
                      <Text style={s.salonPrice}>
                        ₱{suggestedStyleService.price.toLocaleString()}
                      </Text>
                      <Text style={s.small}>
                        {suggestedStyleService.duration_minutes} min
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="arrow-forward-circle"
                    size={26}
                    color={C.rose}
                  />
                </Pressable>
              )}
              {salonDetailTab === 'Services' && <ServiceCategoryFilters services={salonServices} value={serviceCategoryFilter} onChange={setServiceCategoryFilter} />}
              {salonServices.length ? (
                <View style={s.salonDetailGrid}>
                  {!salonServices.some(service => matchesServiceCategory(service, serviceCategoryFilter)) && <Text style={s.small}>No services in this category.</Text>}
                  {salonServices.filter(service => matchesServiceCategory(service, serviceCategoryFilter)).map((service) => (
                    <Pressable
                      onPress={() => {
                        setSelectedService(service);
                        setScreen("datetime");
                      }}
                      style={({ pressed }) => [
                        s.salonServiceCard,
                        pressed && s.pressed,
                      ]}
                      key={service.id}
                    >
                      <View style={s.salonServiceIcon}>
                        <Ionicons name="cut-outline" size={22} color={C.rose} />
                      </View>
                      <View style={s.salonCardGrow}>
                        <Text style={s.cardTitle}>{service.name}</Text>
                        {service.description && (
                          <Text numberOfLines={2} style={s.small}>
                            {service.description}
                          </Text>
                        )}
                        <View style={s.salonServiceMeta}>
                          <Text style={s.salonPrice}>
                            ₱{service.price.toLocaleString()}
                          </Text>
                          <Text style={s.small}>
                            {service.duration_minutes} min
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name="arrow-forward-circle"
                        size={26}
                        color={C.rose}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={s.salonEmptyCard}>
                  <Ionicons name="cut-outline" size={28} color={C.rose} />
                  <View>
                    <Text style={s.cardTitle}>Services coming soon</Text>
                    <Text style={s.small}>
                      This salon has not published its menu yet.
                    </Text>
                  </View>
                </View>
              )}</>}

              {salonDetailTab === 'Staff' && <><SectionTitle title="Available staff" />
              {salonStaff.length ? (
                <View style={s.salonDetailGrid}>
                  {rankStylists(salonStaff, selectedRecommendation?.name).map((staff) => {
                    const selected = selectedStylist?.id === staff.id;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() =>
                          setSelectedStylist(selected ? null : staff)
                        }
                        style={({ pressed }) => [
                          s.staffCard,
                          selected && s.staffCardSelected,
                          pressed && s.pressed,
                        ]}
                        key={staff.id}
                      >
                        {staff.imageUrl ? (
                          <Image
                            source={{ uri: getApiAssetUrl(staff.imageUrl)! }}
                            style={[
                              s.staffAvatarImage,
                              selected && s.staffAvatarSelected,
                            ]}
                          />
                        ) : (
                          <View
                            style={[
                              s.staffAvatar,
                              selected && s.staffAvatarSelected,
                            ]}
                          >
                            <Text style={s.staffInitial}>
                              {staff.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Pressable accessibilityRole="button" accessibilityLabel={`View ${staff.name}'s profile and client feedback`} onPress={() => setQuickProfileStylist(staff)} style={s.salonCardGrow}>
                          <Text style={s.cardTitle}>{staff.name}</Text>
                          {staff.hairstyleMatch && <Text style={s.availableText}>Recommended · specialty matches your haircut</Text>}
                          <Text style={s.small}>
                            {staff.specialties || "Salon professional"}
                          </Text>
                          <View style={s.availableBadge}>
                            <View style={s.availableDot} />
                            <Text style={s.availableText}>Available</Text>
                          </View>
                          <Text style={[s.availableText, { marginTop: 7 }]}>View profile & feedback</Text>
                        </Pressable>
                        <Ionicons
                          name={
                            selected ? "checkmark-circle" : "add-circle-outline"
                          }
                          size={25}
                          color={C.rose}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={s.salonEmptyCard}>
                  <Ionicons name="people-outline" size={28} color={C.rose} />
                  <View>
                    <Text style={s.cardTitle}>
                      No staff profiles published yet
                    </Text>
                    <Text style={s.small}>
                      You can still book and the salon will assign an available
                      professional.
                    </Text>
                  </View>
                </View>
              )}</>}

              {salonDetailTab === 'Reviews' && <><View style={s.reviewHeading}>
                <SectionTitle title="Customer reviews" />
                <View style={s.reviewSummaryPill}>
                  <Ionicons name="star" size={15} color={C.gold} />
                  <Text style={s.reviewSummaryText}>
                    {salonReviewSummary.count
                      ? `${salonReviewSummary.average.toFixed(1)} (${salonReviewSummary.count})`
                      : "No ratings"}
                  </Text>
                </View>
              </View>
              {salonReviews.length ? (
                <View style={s.reviewList}>
                  {salonReviews.map((review) => (
                    <View
                      style={[
                        s.reviewCard,
                        editingReviewId === review.id && s.reviewCardEditing,
                      ]}
                      key={review.id}
                    >
                      <View style={s.reviewTop}>
                        <View style={s.reviewAvatar}>
                          <Text style={s.reviewInitial}>
                            {review.reviewerName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={s.salonCardGrow}>
                          <Text style={s.cardTitle}>{review.reviewerName}</Text>
                          <Text style={s.small}>
                            {new Date(review.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={s.reviewActions}>
                          <View style={s.reviewStars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={
                                  star <= review.rating
                                    ? "star"
                                    : "star-outline"
                                }
                                size={14}
                                color={C.gold}
                              />
                            ))}
                          </View>
                          {mySalonReviewIds.includes(review.id) && (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Edit this review"
                              onPress={() => editSalonReview(review)}
                              style={({ pressed }) => [
                                s.reviewEditButton,
                                pressed && s.pressed,
                              ]}
                            >
                              <Ionicons
                                name="create-outline"
                                size={15}
                                color={C.rose}
                              />
                              <Text style={s.reviewEditText}>Edit</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      {review.imageUrl && (
                        <Image
                          source={{ uri: getApiAssetUrl(review.imageUrl)! }}
                          style={s.reviewPhoto}
                        />
                      )}
                      {review.comment && (
                        <Text style={s.reviewComment}>{review.comment}</Text>
                      )}
                      {review.replies.map((reply) => (
                        <View style={s.salonOwnerReply} key={reply.id}>
                          <View style={s.salonOwnerReplyHead}>
                            <Ionicons
                              name="storefront"
                              size={16}
                              color={C.rose}
                            />
                            <Text style={s.salonOwnerReplyLabel}>
                              {(
                                reply.salonName ||
                                selectedSalon?.name ||
                                "SALON"
                              ).toUpperCase()}{" "}
                              REPLIED
                            </Text>
                          </View>
                          {reply.imageUrl && (
                            <Image
                              source={{ uri: getApiAssetUrl(reply.imageUrl)! }}
                              style={s.replyPhoto}
                            />
                          )}
                          {reply.message && (
                            <Text style={s.salonOwnerReplyText}>
                              {reply.message}
                            </Text>
                          )}
                          <Text style={s.salonOwnerReplyDate}>
                            {new Date(reply.createdAt).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.salonEmptyCard}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={28}
                    color={C.rose}
                  />
                  <View>
                    <Text style={s.cardTitle}>No reviews yet</Text>
                    <Text style={s.small}>
                      Share the first verified hAIrfit review for this salon.
                    </Text>
                  </View>
                </View>
              )}</>}

              {authToken ? (
                <View style={s.reviewComposer}>
                  <View style={s.reviewComposerHeading}>
                    <View>
                      <Text style={s.cardTitle}>
                        {editingReviewId
                          ? "Edit selected review"
                          : "Write another review"}
                      </Text>
                      <Text style={s.small}>
                        {editingReviewId
                          ? "Only this review will be updated."
                          : "You can publish as many separate reviews as you need."}
                      </Text>
                    </View>
                    {editingReviewId && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={cancelReviewEdit}
                        style={({ pressed }) => [
                          s.reviewCancelButton,
                          pressed && s.pressed,
                        ]}
                      >
                        <Text style={s.reviewCancelText}>Cancel edit</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={s.reviewPicker}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
                        accessibilityState={{ checked: reviewRating === star }}
                        hitSlop={5}
                        onPress={() => setReviewRating(star)}
                        key={star}
                      >
                        <Ionicons
                          name={star <= reviewRating ? "star" : "star-outline"}
                          size={30}
                          color={C.gold}
                        />
                      </Pressable>
                    ))}
                  </View>
                  {reviewImageUri ? (
                    <View style={s.reviewPhotoPreview}>
                      <Image
                        source={{ uri: reviewImageUri }}
                        style={s.reviewPreviewImage}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove review photo"
                        onPress={() => {
                          setReviewImageUri(null);
                          setReviewImageData(null);
                        }}
                        style={({ pressed }) => [
                          s.reviewPhotoRemove,
                          pressed && s.pressed,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={C.white}
                        />
                        <Text style={s.reviewPhotoRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void pickReviewImage()}
                      style={({ pressed }) => [
                        s.reviewPhotoPicker,
                        pressed && s.pressed,
                      ]}
                    >
                      <View style={s.reviewPhotoPickerIcon}>
                        <Ionicons
                          name="camera-outline"
                          size={23}
                          color={C.rose}
                        />
                      </View>
                      <View style={s.salonCardGrow}>
                        <Text style={s.cardTitle}>Add a review photo</Text>
                        <Text style={s.small}>
                          JPG, PNG, or WebP · up to 2.5 MB
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={25} color={C.rose} />
                    </Pressable>
                  )}
                  <TextInput
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    maxLength={500}
                    multiline
                    placeholder="What stood out about your visit?"
                    placeholderTextColor="#4A765A"
                    style={s.reviewInput}
                  />
                  <Text style={s.reviewCharacterCount}>
                    {reviewComment.length}/500
                  </Text>
                  <Button
                    label={
                      reviewSaving
                        ? "Saving…"
                        : editingReviewId
                          ? "Save review changes"
                          : "Publish new review"
                    }
                    disabled={reviewRating === 0 || reviewSaving}
                    onPress={() => void submitSalonReview()}
                    icon="send"
                  />
                </View>
              ) : (
                <View style={s.salonEmptyCard}>
                  <Ionicons name="log-in-outline" size={28} color={C.rose} />
                  <View>
                    <Text style={s.cardTitle}>Log in to leave a review</Text>
                    <Text style={s.small}>
                      Reviews are connected to verified hAIrfit accounts.
                    </Text>
                  </View>
                </View>
              )}
              <Button
                label="Choose a service"
                disabled={salonServices.length === 0}
                onPress={() => setScreen("service")}
                icon="calendar-outline"
              />
            </>
          )}
        </>
      ) : (
        <View style={s.dataState}>
          <Text style={s.cardTitle}>Choose a salon first</Text>
          <Button label="Browse salons" onPress={() => setScreen("salons")} />
        </View>
      )}
    </ScreenFrame>
  );

  const selection = (_kind: "service" | "stylist") => (
    <ScreenFrame key={`booking-selection-${_kind}`}>
      <Header
        title="Book an appointment"
        onBack={() => setScreen("salon-detail")}
      />
      <View style={s.progress}>
        <View style={[s.progressFill, { width: "50%" }]} />
      </View>
      <Text style={s.eyebrow}>STEP 1 OF 2</Text>
      <Text style={s.title}>Choose your service</Text>
      <Text style={s.body}>
        {selectedSalon?.name} · Select one service to continue.
      </Text>
      {selectedRecommendation && (
        <View style={s.notice}>
          <Ionicons name="sparkles" size={22} color={C.rose} />
          <View style={s.salonCardGrow}>
            <Text style={s.cardTitle}>{selectedRecommendation.name}</Text>
            <Text style={s.small}>
              hAIrfit selected Premium Style Haircut for this look. You can
              choose another service below.
            </Text>
          </View>
        </View>
      )}
      <ServiceCategoryFilters services={salonServices} value={serviceCategoryFilter} onChange={setServiceCategoryFilter} />
      <View style={s.bookingServiceList}>
        {!salonServices.some(service => matchesServiceCategory(service, serviceCategoryFilter)) && <Text style={s.small}>No services in this category. Choose another category.</Text>}
        {salonServices.filter(service => matchesServiceCategory(service, serviceCategoryFilter)).map((service) => {
          const selected = selectedService?.id === service.id;
          const faceFitPick = Boolean(
            selectedRecommendation && service.id === suggestedStyleService?.id,
          );
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={service.id}
              onPress={() => setSelectedService(service)}
              style={({ pressed }) => [
                s.choiceCard,
                s.bookingServiceChoice,
                selected && s.choiceSelected,
                pressed && s.pressed,
              ]}
            >
              <View style={s.choiceIcon}>
                <Ionicons
                  name={faceFitPick ? "sparkles" : "cut"}
                  size={24}
                  color={C.rose}
                />
              </View>
              <View style={s.salonCardGrow}>
                {faceFitPick && <Text style={s.eyebrow}>hAIrfit PICK</Text>}
                <Text style={s.cardTitle}>{service.name}</Text>
                {service.description && (
                  <Text numberOfLines={2} style={s.small}>
                    {service.description}
                  </Text>
                )}
                <View style={s.salonServiceMeta}>
                  <Text style={s.salonPrice}>
                    ₱{service.price.toLocaleString()}
                  </Text>
                  <Text style={s.small}>{service.duration_minutes} min</Text>
                </View>
              </View>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={25}
                color={selected ? C.rose : C.muted}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={s.bottomSpace} />
      {selectedService && (
        <View style={s.notice}>
          <Ionicons name="checkmark-circle" size={22} color={C.rose} />
          <View style={s.salonCardGrow}>
            <Text style={s.cardTitle}>{selectedService.name} selected</Text>
            <Text style={s.small}>
              ₱{selectedService.price.toLocaleString()} ·{" "}
              {selectedService.duration_minutes} minutes
            </Text>
          </View>
        </View>
      )}
      <Button
        label="Continue to date & time"
        disabled={!selectedService}
        onPress={() => setScreen("datetime")}
        icon="arrow-forward"
      />
    </ScreenFrame>
  );

  const datetime = (
    <>
    <ScreenFrame key="booking-datetime">
      <View style={s.bookingContent}>
      <Header title="Date & time" onBack={() => setScreen("service")} />
      <View style={s.bookingHero}>
        <Image accessibilityLabel="Bright, modern salon interior" source={salonListingCover} resizeMode="cover" style={s.bookingHeroImage} />
        <View style={s.bookingHeroShade} />
        <View style={s.bookingHeroCopy}>
          <Text style={s.bookingHeroEyebrow}>FACE-FIT · SALON BOOKING</Text>
          <Text style={s.bookingHeroTitle}>Book Your Appointment</Text>
          <Text style={s.bookingHeroSubtitle}>Choose a date and time that works for you.</Text>
        </View>
      </View>
      {!!bookedStylistId && <View style={s.notice}><Text style={s.cardTitle}>{selectedStylist?.name || 'Your selected stylist'}</Text><Text style={s.small}>{selectedRecommendation?.name} · {selectedService?.name} · PHP {Number(selectedService?.price || 0).toLocaleString()} · {selectedService?.duration_minutes} min</Text><Text style={s.small}>Your stylist and haircut are selected. Choose your date and time below.</Text></View>}
      <View style={s.bookingCalendarCard}>
      <View style={s.bookingMonthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={
            calendarMonth <= new Date(today.getFullYear(), today.getMonth(), 1)
          }
          onPress={() =>
            setCalendarMonth(
              (month) => new Date(month.getFullYear(), month.getMonth() - 1, 1),
            )
          }
          style={[s.bookingMonthButton,
            calendarMonth <=
              new Date(today.getFullYear(), today.getMonth(), 1) &&
            s.disabledControl
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={C.rose} />
        </Pressable>
        <View style={s.bookingMonthTitle}><Ionicons name="calendar-outline" size={17} color={C.rose} /><Text style={s.bookingMonthText}>
          {calendarMonth.toLocaleDateString([], {
            month: "long",
            year: "numeric",
          })}
        </Text></View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={s.bookingMonthButton}
          onPress={() =>
            setCalendarMonth(
              (month) => new Date(month.getFullYear(), month.getMonth() + 1, 1),
            )
          }
        >
          <Ionicons name="chevron-forward" size={18} color={C.rose} />
        </Pressable>
      </View>
      <View style={s.bookingCalendar}>
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <View key={`${label}${index}`} style={s.bookingWeekday}>
            <Text style={s.calendarWeekday}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</Text>
          </View>
        ))}
        {calendarDays.map((day, index) => {
          if (day === null) return <View key={`blank${index}`} style={s.bookingDay} />;
          const date = new Date(
            calendarMonth.getFullYear(),
            calendarMonth.getMonth(),
            day,
          );
          const key = toDateKey(date);
          const disabled = date < today;
          const active = selectedDate === key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: active }}
              disabled={disabled}
              onPress={() => {
                setSelectedDate(key);
                setSelectedTime(null);
                setStaffDropdownOpen(false);
                staffAvailabilityRequest.current++;
                setStaffPickerLoading(false);
                if (!bookedStylistId) setSelectedStylist(null);
              }}
              key={key}
              style={[s.bookingDay, active && s.bookingDayActive]}
            >
              <Text
                style={[
                  s.bookingDayText,
                  disabled && s.dayTextDisabled,
                  active && s.dayTextActive,
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </View>
      {selectedSalon && !bookedStylistId && (
        <View style={s.bookingStaffCard}>
          <View style={s.bookingStaffHeading}>
            <Ionicons name="people" size={16} color={C.rose} />
            <View style={s.salonCardGrow}>
              <Text style={s.bookingSectionTitle}>Staff & Availability</Text>
              <Text style={s.bookingSectionSubtitle}>All times are Philippine time. Availability follows salon hours and current bookings.</Text>
            </View>
          </View>
          <View style={s.bookingStaffControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectedStylist ? `Selected stylist ${selectedStylist.name}. Change stylist` : "Choose a stylist"}
              accessibilityState={{ expanded: staffDropdownOpen }}
              onPress={() => setStaffDropdownOpen(value => !value)}
              style={s.staffSelectDropdown}
            >
              {selectedStylist?.imageUrl ? (
                <Image source={{ uri: getApiAssetUrl(selectedStylist.imageUrl)! }} style={s.bookingStaffAvatar} />
              ) : (
                <View style={s.bookingStaffAvatarFallback}>
                  <Ionicons name="person" size={17} color={C.rose} />
                </View>
              )}
              <View style={s.salonCardGrow}>
                <Text numberOfLines={1} style={s.bookingStaffName}>{selectedStylist?.name || "Choose a stylist"}</Text>
                <Text numberOfLines={1} style={s.bookingSectionSubtitle}>{selectedStylist?.specialties || "Hair stylist"}</Text>
              </View>
              <Ionicons name={staffDropdownOpen ? "chevron-up" : "chevron-down"} size={17} color={C.rose} />
            </Pressable>
            <View style={s.bookingStaffTip}>
              <Ionicons name="calendar-outline" size={17} color={C.rose} />
              <Text style={s.bookingStaffTipText}>{selectedDate ? "Staff availability is shown for your selected date." : "Choose a day in the booking calendar to see staff availability."}</Text>
              <Ionicons name="sparkles" size={13} color="#8BAE83" />
            </View>
          </View>
          {staffDropdownOpen && (
            <View style={s.bookingStaffMenu}>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: !selectedStylist }} onPress={() => { setSelectedStylist(null); setStaffDropdownOpen(false); }} style={s.bookingStaffOption}>
                <View style={s.bookingStaffAvatarFallback}><Ionicons name="people-outline" size={16} color={C.rose} /></View>
                <View style={s.salonCardGrow}><Text style={s.bookingStaffName}>Any available stylist</Text><Text style={s.bookingSectionSubtitle}>Let the salon assign a professional</Text></View>
                {!selectedStylist && <Ionicons name="checkmark-circle" size={19} color={C.rose} />}
              </Pressable>
                {rankStylists(salonStaff, selectedRecommendation?.name).map(member => (
                <Pressable key={member.id} accessibilityRole="radio" accessibilityState={{ checked: selectedStylist?.id === member.id }} onPress={() => { setSelectedStylist(member); }} style={s.bookingStaffOption}>
                  {member.imageUrl ? <Image source={{ uri: getApiAssetUrl(member.imageUrl)! }} style={s.bookingStaffAvatar} /> : <View style={s.bookingStaffAvatarFallback}><Text style={s.bookingStaffInitial}>{member.name.charAt(0).toUpperCase()}</Text></View>}
                  <View style={s.salonCardGrow}><Text numberOfLines={1} style={s.bookingStaffName}>{member.name}</Text><Text numberOfLines={1} style={s.bookingSectionSubtitle}>{member.specialties || "Salon professional"}</Text></View>
                  {selectedStylist?.id === member.id && <Ionicons name="checkmark-circle" size={19} color={C.rose} />}
                </Pressable>
              ))}
              {!salonStaff.length && <Text style={s.bookingHint}>The salon has not added staff profiles yet.</Text>}
              {!!selectedDate && !!selectedStylist && <StaffSchedulePanel inline followSelectedDate showHeading={false} selectedStaffId={selectedStylist.id} salonId={selectedSalon.id} token={authToken} initialDate={selectedDate} />}
            </View>
          )}
        </View>
      )}
      <View style={s.bookingAvailabilityCard}>
      <View style={s.bookingSectionHeading}><View style={s.bookingSectionIcon}><Ionicons name="time-outline" size={17} color={C.rose} /></View><View><Text style={s.bookingSectionTitle}>Available times</Text><Text style={s.bookingSectionSubtitle}>Requests can still be sent while the salon is closed.</Text></View></View>
      {!selectedDate && <Text style={s.bookingHint}>Choose a day in the calendar to see available times.</Text>}
      <View style={s.timeGrid}>
        {timeOptions.map((option) => {
          const disabled = !selectedDate || isTimePast(option.value) || (!!selectedSalon && !isSalonSlotAvailable(selectedSalon, option.value, selectedService?.duration_minutes || 0));
          const active = selectedTime === option.value;
          return (
            <Pressable
              disabled={disabled}
              onPress={() => void chooseAppointmentTime(option.value)}
              style={[
                s.bookingTime,
                active && s.timeActive,
                disabled && s.timeDisabled,
              ]}
              key={option.value}
            >
              <Text
                style={[
                  s.chipText,
                  active && s.timeTextActive,
                  disabled && s.dayTextDisabled,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </View>
      {selectedTime && (
        <Text style={s.small}>
          {selectedStylist
            ? selectedStylist.isBusy ? `${selectedStylist.name} selected ? you will join the waiting queue.` : `${selectedStylist.name} selected for this time.`
            : salonStaff.length === 0 && !staffPickerLoading
              ? "The salon will assign a professional if one becomes available."
              : "Tap the selected time to choose a different staff member."}
        </Text>
      )}
      {!!selectedStylist?.isBusy && <View style={s.notice}><Text style={s.small}>This stylist is busy at your requested time. By continuing you join the waiting queue. You may need to wait; the salon will confirm your actual start when the stylist is free.</Text></View>}
      <Button
        label="Review booking"
        disabled={
          staffPickerLoading ||
          !selectedService ||
          !selectedDate ||
          !selectedTime ||
          (salonStaff.length > 0 && !selectedStylist)
        }
        onPress={() => setScreen("summary")}
      />
      </View>
    </ScreenFrame>
    <StaffPickerModal
      visible={staffPickerVisible && !bookedStylistId}
      loading={staffPickerLoading}
      staff={rankStylists(salonStaff, selectedRecommendation?.name)}
      selectedId={selectedStylist?.id}
      dateLabel={selectedDateLabel}
      timeLabel={selectedTimeLabel}
      onClose={() => setStaffPickerVisible(false)}
      onSelect={(staff) => { setSelectedStylist(staff); setStaffPickerVisible(false); }}
    />
    </>
  );

  const summary = (
    <ScreenFrame key="booking-summary">
      <Header title="Review booking" onBack={() => setScreen("datetime")} />
      <Text style={s.eyebrow}>ALMOST DONE</Text>
      <Text style={s.title}>{selectedStylist?.isBusy ? "Review waiting queue request" : "Confirm your appointment"}</Text>
      {!!selectedStylist?.isBusy && <Text style={s.body}>You are joining this stylist's waiting queue. Your chosen time is a request; the actual start may be later and must be confirmed by the salon.</Text>}
      <View style={s.summaryCard}>
        {selectedSalon && (
          <SalonLogo
            name={selectedSalon.name}
            imageUrl={selectedSalon.profileImageUrl}
          />
        )}
        <Text style={s.title}>{selectedSalon?.name}</Text>
        <Text style={s.body}>{selectedService?.name}</Text>
        {selectedRecommendation && (
          <View style={s.notice}>
            <Ionicons name="sparkles" size={20} color={C.rose} />
            <View style={s.salonCardGrow}>
              <Text style={s.cardTitle}>{selectedRecommendation.name}</Text>
              <Text style={s.small}>
                Your hAIrfit hairstyle recommendation will be shared with the
                salon.
              </Text>
            </View>
          </View>
        )}
        <View style={s.divider} />
        {[
          ["calendar", selectedDateLabel],
          [
            "time",
            `${selectedTimeLabel} · ${selectedService?.duration_minutes || 0} min`,
          ],
          ["person", selectedStylist?.name || "Any available professional"],
          ["location", selectedSalon?.address || "Nasugbu, Batangas"],
        ].map((x) => (
          <View style={s.summaryRow} key={x[0]}>
            <Ionicons
              name={x[0] as keyof typeof Ionicons.glyphMap}
              size={21}
              color={C.rose}
            />
            <Text style={s.cardTitle}>{x[1]}</Text>
          </View>
        ))}
        <View style={s.divider} />
        <View style={s.sectionHead}>
          <Text style={s.cardTitle}>Estimated total</Text>
          <Text style={s.price}>
            ₱{selectedService?.price.toLocaleString()}
          </Text>
        </View>
        <View style={s.sectionHead}>
          <Text style={s.cardTitle}>20% down payment</Text>
          <Text style={s.cardTitle}>PHP {(Math.round(Number(selectedService?.price || 0) * 20) / 100).toFixed(2)}</Text>
        </View>
        <Text style={s.small}>Pay through GCash after submitting this request. The salon must verify your payment before confirming.</Text>
      </View>
      <View style={s.notice}>
        <Ionicons name="information-circle" size={21} color={C.rose} />
        <Text style={s.small}>
          A 20% GCash down payment is required before salon confirmation. Submit payment proof from My bookings after placing your request. Contact the salon for its GCash recipient and cancellation terms before paying.
        </Text>
      </View>
      {bookingError && (
        <View style={s.authError}>
          <Text style={s.authErrorText}>{bookingError}</Text>
        </View>
      )}
      <Button
        label={bookingLoading ? "Submitting…" : "Submit booking request"}
        disabled={
          !selectedService || !selectedDate || !selectedTime || bookingLoading
        }
        onPress={() => void confirmBooking()}
        icon="checkmark-circle"
      />
    </ScreenFrame>
  );

  const success = (
    <ScreenFrame scroll={false}>
      <View style={s.centerPage}>
        <View style={s.successIcon}>
          <Ionicons name="checkmark" size={52} color={C.white} />
        </View>
        <Text style={s.display}>Booking requested</Text>
        <Text style={[s.body, s.centerText]}>
          Your request at {selectedSalon?.name} was saved. Submit your 20% down payment from My bookings for salon verification.
        </Text>
        <View style={s.ticket}>
          <Text style={s.eyebrow}>
            {selectedDateLabel.toUpperCase()} ·{" "}
            {selectedTimeLabel.toUpperCase()}
          </Text>
          <Text style={s.title}>{selectedService?.name}</Text>
          <Text style={s.body}>
            {selectedStylist?.name || "Any available professional"}
          </Text>
          <Text style={s.body}>Status: pending confirmation</Text>
        </View>
        <Button
          label="Download appointment proof"
          onPress={() => void downloadAppointmentProof()}
          icon="download-outline"
        />
        <Button
          label="View my bookings"
          onPress={() => setScreen("bookings")}
          secondary
        />
        <Button
          label="Back to home"
          onPress={() => setScreen("home")}
          secondary
        />
      </View>
    </ScreenFrame>
  );

  const filteredClientBookings = bookingRecords.filter(booking => clientBookingFilter === 'all' || booking.status === clientBookingFilter);
  const bookings = (
    <ScreenFrame>
      <Header
        title="My bookings"
        action="notifications-outline"
        onAction={() => showNotifications("bookings")}
        actionBadge={notificationUnreadCount}
      />
      <BookingStatusFilters value={clientBookingFilter} onChange={setClientBookingFilter} bookings={bookingRecords} />
      {bookingsLoading ? (
        <ActivityIndicator color={C.rose} style={s.dataLoader} />
      ) : bookingsError ? (
        <Pressable onPress={() => void loadBookings()} style={s.dataState}>
          <Ionicons name="cloud-offline-outline" size={28} color={C.rose} />
          <Text style={s.cardTitle}>Could not load bookings</Text>
          <Text style={s.small}>{bookingsError} · Tap to retry</Text>
        </Pressable>
      ) : filteredClientBookings.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="calendar-outline" size={40} color="#EDF5EE" />
          <Text style={s.cardTitle}>{clientBookingFilter === "all" ? "No appointments yet" : `No ${clientBookingFilter} bookings`}</Text>
          <Text style={s.small}>
            {clientBookingFilter === "all" ? "Bookings you make with a salon will appear here." : "Choose another status to view your other appointments."}
          </Text>
        </View>
      ) : (
        filteredClientBookings.map((booking) => (
          <View style={s.bookingCard} key={booking.id}>
            <Text style={s.eyebrow}>
              {new Date(booking.appointmentAt)
                .toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                .toUpperCase()}
            </Text>
            <Text style={s.title}>{booking.serviceName}</Text>
            <Text style={s.body}>
              {booking.salonName}
              {booking.stylistName ? ` · ${booking.stylistName}` : ""}
            </Text>
            <View style={s.divider} />
            <View style={s.bookingMeta}>
              <Text style={s.chipText}>₱{booking.price.toLocaleString()}</Text>
              <Text style={s.chipText}>{booking.durationMinutes} min</Text>
              <Text style={s.bookingStatus}>{booking.status}</Text>
            </View>
            {booking.status === 'completed' && booking.stylistName && <View style={[s.stylistFeedbackCard, !!booking.stylistReviewRating && s.stylistFeedbackSent]}>
              {!!booking.stylistReviewRating ? <>
                <View style={s.stylistFeedbackHeader}><View style={s.stylistFeedbackIcon}><Ionicons name="checkmark" size={20} color={C.white}/></View><View style={{ flex: 1 }}><Text style={s.stylistFeedbackTitle}>Feedback sent</Text><Text style={s.stylistFeedbackSub}>Thanks for sharing your experience with {booking.stylistName}.</Text></View><Ionicons name="sparkles" size={21} color={C.gold}/></View>
              </> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={s.stylistFeedbackIconPending}><Ionicons name="star" size={18} color={C.rose}/></View><View style={{ flex: 1 }}><Text style={s.stylistFeedbackTitle}>Share stylist feedback</Text><Text style={s.stylistFeedbackSub}>How was your experience with {booking.stylistName}?</Text></View></View>}
              {!booking.stylistReviewRating && <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="button" accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`} accessibilityState={{ selected: (stylistReviewDrafts[booking.id]?.rating ?? booking.stylistReviewRating ?? 0) >= star }} onPress={() => setStylistReviewDrafts(current => ({ ...current, [booking.id]: { rating: star, comment: current[booking.id]?.comment ?? booking.stylistReviewComment ?? '' } }))} style={{ padding: 4 }}><Ionicons name={(stylistReviewDrafts[booking.id]?.rating ?? booking.stylistReviewRating ?? 0) >= star ? 'star' : 'star-outline'} size={25} color={C.gold}/></Pressable>)}
              </View>}
              {!booking.stylistReviewRating && <TextInput accessibilityLabel="Feedback for stylist" value={stylistReviewDrafts[booking.id]?.comment ?? ''} onChangeText={value => setStylistReviewDrafts(current => ({ ...current, [booking.id]: { rating: current[booking.id]?.rating ?? 0, comment: value } }))} placeholder="Write a few words about your visit…" placeholderTextColor={C.muted} multiline maxLength={1000} style={s.stylistFeedbackInput}/>}
              {!booking.stylistReviewRating && <Button label={stylistReviewSavingId === booking.id ? 'Sending…' : 'Send stylist feedback'} onPress={() => void submitStylistFeedback(booking)} disabled={stylistReviewSavingId !== null || !(stylistReviewDrafts[booking.id]?.rating ?? booking.stylistReviewRating)} icon="send-outline"/>}
              {!!booking.stylistReviewRating && <View style={s.stylistFeedbackQuote}><View style={s.stylistFeedbackQuoteTop}><Text style={s.stylistFeedbackStars}>{'★'.repeat(booking.stylistReviewRating)}{'☆'.repeat(5 - booking.stylistReviewRating)}</Text><Text style={s.stylistFeedbackYourRating}>YOUR RATING</Text></View><Text style={s.stylistFeedbackQuoteText}>{booking.stylistReviewComment ? `“${booking.stylistReviewComment}”` : 'Thank you for sharing your rating.'}</Text></View>}
            </View>}
            {authToken && <BookingActions booking={booking} token={authToken} onUpdated={loadBookings}
              chooseReceipt={() => chooseImage("your payment receipt", false)}
              onRebook={() => {
                const salon = salonRecords.find(item => item.id === booking.salonId);
                if (salon) void openSalon(salon);
                else { setSalonSearchQuery(booking.salonName); setScreen("salons"); }
              }} />}
          </View>
        ))
      )}
    </ScreenFrame>
  );

  const profile = (
    <ScreenFrame>
      <View style={s.profileHeaderWrap}>
        <Header title="Profile" action="settings-outline" onAction={() => setProfileMenuOpen((open) => !open)} />
        {profileMenuOpen && (
          <View style={s.profileHeaderMenu}>
            <Pressable accessibilityRole="button" onPress={() => { setProfileMenuOpen(false); setScreen("settings"); }} style={s.profileHeaderMenuItem}>
              <Ionicons name="settings-outline" size={19} color={C.ink} />
              <Text style={s.cardTitle}>Settings</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => {
              setProfileMenuOpen(false);
              logout();
            }} style={s.profileHeaderMenuItem}>
              <Ionicons name="log-out-outline" size={19} color={C.ink} />
              <Text style={s.cardTitle}>Log out</Text>
            </Pressable>
          </View>
        )}
      </View>
      {profileLoading && !userProfile ? (
        <ActivityIndicator color={C.rose} style={s.dataLoader} />
      ) : profileError && !userProfile ? (
        <Pressable onPress={() => void loadProfile()} style={s.dataState}>
          <Ionicons name="cloud-offline-outline" size={26} color={C.rose} />
          <Text style={s.cardTitle}>Could not load profile</Text>
          <Text style={s.small}>{profileError} · Tap to retry</Text>
        </Pressable>
      ) : (
        <>
          <View style={s.profileHead}>
            {userProfile?.profileImageUrl ? (
              <Image
                accessibilityLabel="Profile picture"
                source={{ uri: getApiAssetUrl(userProfile.profileImageUrl)! }}
                style={s.profileAvatarImage}
              />
            ) : (
              <View style={s.profileAvatar}>
                <Text style={s.profileInitial}>
                  {authUser?.fullName.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.title}>
                {userProfile?.fullName || authUser?.fullName || "hAIrfit user"}
              </Text>
            </View>
          </View>
          <View style={s.preferenceCard}>
            <Text style={s.eyebrow}>MY HAIR PROFILE</Text>
            <View style={s.preferenceRow}>
              {[
                ["Type", hairScalpAnalysis?.hairType || userProfile?.hairType],
                ["Length", hairScalpAnalysis?.hairLength || userProfile?.hairLength],
                ["Texture", hairScalpAnalysis?.hairTexture || userProfile?.hairTexture],
                ["Face shape", faceAnalysis?.faceShape || userProfile?.faceShape],
              ].map((x) => (
                <View style={s.preferenceItem} key={x[0]}>
                  <Text style={s.small}>{x[0]}</Text>
                  <Text style={s.cardTitle}>{x[1] || "Not set"}</Text>
                </View>
              ))}
            </View>
            {faceAnalysis && (
              <>
                <Text style={[s.eyebrow, { marginTop: 16 }]}>LATEST SCAN MEASUREMENTS</Text>
                <View style={s.preferenceRow}>
                  <View style={s.preferenceItem}>
                    <Text style={s.small}>Length / width</Text>
                    <Text style={s.cardTitle}>{faceAnalysis.measurements.lengthToWidth.toFixed(2)}×</Text>
                  </View>
                  <View style={s.preferenceItem}>
                    <Text style={s.small}>Jaw / cheek</Text>
                    <Text style={s.cardTitle}>{faceAnalysis.measurements.jawToCheek.toFixed(2)}×</Text>
                  </View>
                  <View style={s.preferenceItem}>
                    <Text style={s.small}>Forehead / cheek</Text>
                    <Text style={s.cardTitle}>{faceAnalysis.measurements.foreheadToCheek.toFixed(2)}×</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </>
      )}
      {[
        ["heart-outline", "Saved hairstyles", "saved"],
        ["storefront-outline", "Saved salons", "saved-salons"],
        ["notifications-outline", "Notifications", "notifications"],
        ["star-outline", "My reviews", "reviews"],
      ].map((x) => (
        <Pressable
          key={x[1]}
          onPress={() =>
            x[2] === "notifications"
              ? showNotifications("profile")
              : setScreen(x[2] as Screen)
          }
          style={s.menuRow}
        >
          <View style={s.menuIcon}>
            <Ionicons
              name={x[0] as keyof typeof Ionicons.glyphMap}
              size={21}
              color={C.rose}
            />
          </View>
          <Text style={[s.cardTitle, { flex: 1 }]}>{x[1]}</Text>
          {x[2] === "notifications" && notificationUnreadCount > 0 && (
            <View style={s.notificationMenuCount}>
              <Text style={s.notificationBadgeText}>
                {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Pressable>
      ))}
    </ScreenFrame>
  );

  const notificationPage = (owner: boolean) => (
    <ScreenFrame>
      <Header
        title="Notifications"
        onBack={() =>
          setScreen(owner ? "owner-dashboard" : notificationReturnScreen)
        }
      />
      {accountLoading ? (
        <ActivityIndicator color={C.rose} style={s.dataLoader} />
      ) : accountError ? (
        <Pressable onPress={() => void loadAccountScreen()} style={s.dataState}>
          <Text style={s.cardTitle}>Could not load notifications</Text>
          <Text style={s.small}>{accountError} · Tap to retry</Text>
        </Pressable>
      ) : accountItems.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-outline" size={40} color="#EDF5EE" />
          <Text style={s.cardTitle}>No notifications yet</Text>
          <Text style={s.small}>
            Booking and review updates will appear here.
          </Text>
        </View>
      ) : (
        <View style={s.notificationList}>
          {accountItems.map((item) => {
            const unread = !Boolean(item.isRead);
            return (
              <View key={item.id} style={[
                s.notificationCard,
                unread && s.notificationCardUnread,
                { flexDirection: "column", alignItems: "stretch" },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open notification: ${item.title}`}
                accessibilityState={{ selected: unread }}
                onPress={() => void openNotification(item, owner)}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: 12 },
                  pressed && s.pressed,
                ]}
              >
                <View
                  style={[
                    s.notificationIcon,
                    unread && s.notificationIconUnread,
                  ]}
                >
                  <Ionicons
                    name={
                      item.destination?.includes("review")
                        ? "star-outline"
                        : "calendar-outline"
                    }
                    size={21}
                    color={unread ? C.white : C.rose}
                  />
                </View>
                <View style={s.salonCardGrow}>
                  <View style={s.notificationTitleRow}>
                    <Text
                      style={[s.cardTitle, !unread && s.notificationTitleRead]}
                    >
                      {item.title}
                    </Text>
                    {unread && <View style={s.notificationUnreadDot} />}
                  </View>
                  {item.detail && <Text style={s.small}>{item.detail}</Text>}
                  <View style={s.notificationFooter}>
                    <Text style={s.notificationDate}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>

                  </View>
                </View>
                {item.destination && (
                  <Ionicons name="chevron-forward" size={19} color={C.muted} />
                )}
              </Pressable>
              <View style={{ alignItems: "flex-end" }}>
                    {unread && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${item.title} as read`}
                        onPress={() => readNotification(item)}
                        style={({ pressed }) => [
                          s.notificationReadButton,
                          pressed && s.pressed,
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={C.roseDark}
                        />
                        <Text style={s.notificationReadButtonText}>
                          Mark as read
                        </Text>
                      </Pressable>
                    )}
              </View>
              </View>
            );
          })}
        </View>
      )}
    </ScreenFrame>
  );

  const openAccountItem = async (
    item: AccountItem,
    section: "saved" | "saved-salons" | "reviews",
  ) => {
    if (section === "saved") {
      setSelectedAccountItem(item);
      setScreen("saved-style-detail");
      return;
    }
    if (!item.salonId) return;
    let salon = salonRecords.find(
      (record) => record.id === Number(item.salonId),
    );
    if (!salon) {
      try {
        const latestSalons = await getSalons();
        setSalonRecords(latestSalons);
        salon = latestSalons.find(
          (record) => record.id === Number(item.salonId),
        );
      } catch (error) {
        Alert.alert(
          "Unable to open salon",
          error instanceof Error ? error.message : "Please try again.",
        );
        return;
      }
    }
    if (salon) await openSalon(salon, section);
  };

  const accountPage = (
    title: string,
    section: "saved" | "saved-salons" | "reviews",
  ) => (
    <ScreenFrame>
      <Header title={title} onBack={() => setScreen("profile")} />
      {accountLoading ? (
        <ActivityIndicator color={C.rose} style={s.dataLoader} />
      ) : accountError ? (
        <Pressable onPress={() => void loadAccountScreen()} style={s.dataState}>
          <Text style={s.cardTitle}>Could not load {title.toLowerCase()}</Text>
          <Text style={s.small}>{accountError} · Tap to retry</Text>
        </Pressable>
      ) : accountItems.length === 0 ? (
        <View style={s.empty}>
          <Ionicons
            name={title === "My reviews" ? "star-outline" : "heart-outline"}
            size={40}
            color="#EDF5EE"
          />
          <Text style={s.cardTitle}>Nothing here yet</Text>
          <Text style={s.small}>
            Your {title.toLowerCase()} will appear here.
          </Text>
        </View>
      ) : (
        accountItems.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
            onPress={() => void openAccountItem(item, section)}
            style={({ pressed }) => [s.listCard, pressed && s.pressed]}
            key={item.id}
          >
            <View style={s.menuIcon}>
              <Ionicons
                name={
                  title === "My reviews"
                    ? "star"
                    : section === "saved-salons"
                      ? "storefront"
                      : "heart"
                }
                size={20}
                color={C.rose}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{item.title}</Text>
              {item.detail && <Text style={s.small}>{item.detail}</Text>}
              <Text style={s.small}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.muted} />
          </Pressable>
        ))
      )}
    </ScreenFrame>
  );

  const savedStyleDetail = (
    <ScreenFrame>
      <Header title="Saved hairstyle" onBack={() => setScreen("saved")} />
      {selectedAccountItem && (
        <>
          <View style={s.consentHero}>
            <Ionicons name="cut" size={52} color={C.rose} />
          </View>
          <Text style={s.title}>{selectedAccountItem.title}</Text>
          <Text style={s.body}>
            This hairstyle is saved to your hAIrfit account.
          </Text>
          <Text style={s.small}>
            Saved on{" "}
            {new Date(selectedAccountItem.createdAt).toLocaleDateString()}
          </Text>
          <Button
            label="Find a salon for this style"
            onPress={() => setScreen("salons")}
            icon="storefront-outline"
          />
          <Button
            label="Back to saved hairstyles"
            onPress={() => setScreen("saved")}
            secondary
          />
        </>
      )}
    </ScreenFrame>
  );

  const settingsPage = (
    <ScreenFrame>
      {authToken && userProfile ? (
        <CustomerSettingsScreen
          token={authToken}
          profile={userProfile}
          onBack={() => setScreen("profile")}
          onSaved={(updated) => {
            setUserProfile(updated);
            setAuthUser((current) =>
              current
                ? {
                    ...current,
                    fullName: updated.fullName,
                    email: updated.email,
                    phone: updated.phone,
                  }
                : current,
            );
            Alert.alert(
              "Profile updated",
              "Your personal information has been saved.",
            );
          }}
        />
      ) : (
        <View style={s.dataState}>
          <ActivityIndicator color={C.rose} />
          <Text style={s.small}>Loading your profile...</Text>
        </View>
      )}
    </ScreenFrame>
  );

  const ownerManagementPage = (
    page: Exclude<Screen, "owner-dashboard" | "owner-notifications">,
  ) => {
    const titles: Partial<Record<Screen, string>> = {
      "owner-bookings": "Booking requests",
      "owner-services": "Services & pricing",
      "owner-staff": "Staff management",
      "owner-profile": "Business profile",
      "owner-reviews": "Reviews & ratings",
    };
    const title = titles[page] || "Salon management";
    const filteredOwnerBookings = (ownerManagement?.bookings || []).filter(booking => ownerBookingFilter === 'all' || booking.status === ownerBookingFilter);
    let body: React.ReactNode = null;
    if (ownerManagementLoading && !ownerManagement)
      body = <ActivityIndicator color={C.rose} style={s.dataLoader} />;
    else if (ownerManagementError)
      body = (
        <Pressable
          onPress={() => void loadOwnerManagement()}
          style={s.dataState}
        >
          <Ionicons name="cloud-offline-outline" size={28} color={C.rose} />
          <Text style={s.cardTitle}>Could not load {title.toLowerCase()}</Text>
          <Text style={s.small}>{ownerManagementError} · Tap to retry</Text>
        </Pressable>
      );
    else if (ownerManagement) {
      if (page === "owner-bookings")
        body = filteredOwnerBookings.length ? (
          filteredOwnerBookings.map((booking) => (
            <View style={s.bookingCard} key={booking.id}>
              <View style={s.ownerCardTop}>
                <View style={s.salonCardGrow}>
                  <Text style={s.eyebrow}>
                    {new Date(booking.appointmentAt)
                      .toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                      .toUpperCase()}
                  </Text>
                  <Text style={s.title}>{booking.customerName}</Text>
                </View>
                <Text style={s.bookingStatus}>{booking.status}</Text>
              </View>
              <Text style={s.body}>
                {booking.serviceName} · ₱{booking.price.toLocaleString()} ·{" "}
                {booking.durationMinutes} min
              </Text>
              <Text style={s.small}>
                {booking.customerEmail}
                {booking.customerPhone ? ` · ${booking.customerPhone}` : ""}
              </Text>
              <Text style={s.small}>
                {booking.stylistName
                  ? `Staff: ${booking.stylistName}`
                  : "Staff will be assigned by the salon"}
              </Text>
              {booking.notes && (
                <Text style={s.ownerNote}>“{booking.notes}”</Text>
              )}
              {authToken && <BookingActions booking={booking} token={authToken} owner onUpdated={async () => { await Promise.all([loadOwnerManagement(), loadOwnerDashboard()]); }} />}
              {booking.status === "pending" && (
                <View style={s.ownerActionRow}>
                  <Button
                    label={
                      ownerBookingUpdating === booking.id
                        ? "Updating…"
                        : booking.isQueued ? "Confirm next in queue" : "Confirm"
                    }
                    disabled={ownerBookingUpdating !== null || (!!booking.depositStatus && booking.depositStatus !== "verified")}
                    onPress={() =>
                      void changeOwnerBookingStatus(booking.id, "confirmed")
                    }
                  />
                  <Button
                    label="Decline"
                    disabled={ownerBookingUpdating !== null}
                    secondary
                    onPress={() => setConfirmationPrompt({
                      eyebrow: "BOOKING REQUEST",
                      title: "Decline this appointment?",
                      message: "This request will be marked as cancelled, and the customer will see the update.",
                      icon: "calendar-outline",
                      confirmLabel: "Yes, decline",
                      cancelLabel: "No, keep it",
                      onConfirm: () => void changeOwnerBookingStatus(booking.id, "cancelled"),
                    })}
                  />
                </View>
              )}
              {booking.status === "confirmed" && (
                <View style={s.ownerActionRow}>
                  <Button
                    label={
                      ownerBookingUpdating === booking.id
                        ? "Updating…"
                        : "Mark completed"
                    }
                    disabled={ownerBookingUpdating !== null}
                    onPress={() =>
                      void changeOwnerBookingStatus(booking.id, "completed")
                    }
                  />
                  <Button
                    label="Cancel"
                    disabled={ownerBookingUpdating !== null}
                    secondary
                    onPress={() => setConfirmationPrompt({
                      eyebrow: "BOOKING",
                      title: "Cancel this appointment?",
                      message: "The confirmed appointment will be marked as cancelled, and the customer will be notified.",
                      icon: "calendar-outline",
                      confirmLabel: "Yes, cancel",
                      cancelLabel: "No, keep it",
                      onConfirm: () => void changeOwnerBookingStatus(booking.id, "cancelled"),
                    })}
                  />
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={40} color="#EDF5EE" />
            <Text style={s.cardTitle}>{ownerBookingFilter === "all" ? "No client bookings yet" : `No ${ownerBookingFilter} bookings`}</Text>
            <Text style={s.small}>
              {ownerBookingFilter === "all" ? "Client appointment requests will appear here." : "Choose another status to view other client appointments."}
            </Text>
          </View>
        );
      else if (page === "owner-services")
        body = (
          <>
            <View style={s.ownerPageActions}>
              <View>
                <Text style={s.sectionTitle}>Your service menu</Text>
                <Text style={s.small}>
                  {ownerManagement.services.length} service
                  {ownerManagement.services.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setOwnerEditorError(null);
                  setOwnerEditor({
                    kind: "service",
                    name: "",
                    description: "",
                    price: "",
                    durationMinutes: "60",
                    isActive: true,
                  });
                }}
                style={s.ownerAddButton}
              >
                <Ionicons name="add" size={19} color={C.white} />
                <Text style={s.ownerAddButtonText}>Add service</Text>
              </Pressable>
            </View>
            <ServiceCategoryFilters services={ownerManagement.services} value={ownerServiceCategoryFilter} onChange={setOwnerServiceCategoryFilter} />
            {ownerManagement.services.length ? (
              <View style={s.salonDetailGrid}>
                {!ownerManagement.services.some(service => matchesServiceCategory(service, ownerServiceCategoryFilter)) && <Text style={s.small}>No services in this category. Choose another category.</Text>}
                {ownerManagement.services.filter(service => matchesServiceCategory(service, ownerServiceCategoryFilter)).map((service) => (
                  <View style={s.ownerEditableCard} key={service.id}>
                    <View style={s.salonServiceIcon}>
                      <Ionicons name="cut-outline" size={22} color={C.rose} />
                    </View>
                    <View style={s.salonCardGrow}>
                      <View style={s.ownerCardTop}>
                        <Text style={s.cardTitle}>{service.name}</Text>
                        <Text
                          style={[
                            s.ownerState,
                            !service.isActive && s.ownerStateOff,
                          ]}
                        >
                          {service.isActive ? "Active" : "Hidden"}
                        </Text>
                      </View>
                      {service.description && (
                        <Text style={s.small}>{service.description}</Text>
                      )}
                      <View style={s.salonServiceMeta}>
                        <Text style={s.salonPrice}>
                          ₱{service.price.toLocaleString()}
                        </Text>
                        <Text style={s.small}>
                          {service.duration_minutes} min
                        </Text>
                      </View>
                      <View style={s.ownerInlineActions}>
                        <Pressable
                          onPress={() => {
                            setOwnerEditorError(null);
                            setOwnerEditor({
                              kind: "service",
                              id: service.id,
                              name: service.name,
                              description: service.description || "",
                              price: String(service.price),
                              durationMinutes: String(service.duration_minutes),
                              isActive: service.isActive,
                            });
                          }}
                          style={s.ownerEditAction}
                        >
                          <Ionicons
                            name="create-outline"
                            size={16}
                            color={C.rose}
                          />
                          <Text style={s.ownerEditActionText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          disabled={ownerRemoving === `service-${service.id}`}
                          onPress={() =>
                            confirmOwnerRemoval(
                              "service",
                              service.id,
                              service.name,
                            )
                          }
                          style={s.ownerRemoveAction}
                        >
                          {ownerRemoving === `service-${service.id}` ? (
                            <ActivityIndicator size="small" color="#355C45" />
                          ) : (
                            <>
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#355C45"
                              />
                              <Text style={s.ownerRemoveActionText}>
                                Remove
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="pricetag-outline" size={40} color="#EDF5EE" />
                <Text style={s.cardTitle}>No services published</Text>
                <Text style={s.small}>
                  Add your first service so customers can book it.
                </Text>
              </View>
            )}
          </>
        );
      else if (page === "owner-staff")
        body = (
          <>
            <View style={s.ownerPageActions}>
              <View>
                <Text style={s.sectionTitle}>Your salon team</Text>
                <Text style={s.small}>
                  {ownerManagement.staff.length} staff profile
                  {ownerManagement.staff.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setOwnerEditorError(null);
                  setOwnerEditor({
                    kind: "staff",
                    name: "",
                    email: "",
                    phone: "",
                    specialties: "",
                    password: "",
                    isAvailable: true,
                    imageUri: null,
                    imageData: undefined,
                  });
                }}
                style={s.ownerAddButton}
              >
                <Ionicons name="person-add-outline" size={18} color={C.white} />
                <Text style={s.ownerAddButtonText}>Add staff</Text>
              </Pressable>
            </View>
            <StaffSchedulePanel inline salonId={ownerManagement.salon.id} token={authToken} />
            {ownerManagement.staff.length ? (
              <View style={s.salonDetailGrid}>
                {ownerManagement.staff.map((staff) => (
                  <View style={s.ownerEditableCard} key={staff.id}>
                    {staff.imageUrl ? (
                      <Image
                        source={{ uri: getApiAssetUrl(staff.imageUrl)! }}
                        style={s.staffAvatarImage}
                      />
                    ) : (
                      <View style={s.staffAvatar}>
                        <Text style={s.staffInitial}>
                          {staff.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={s.salonCardGrow}>
                      <View style={s.ownerCardTop}>
                        <Text style={s.cardTitle}>{staff.name}</Text>
                        <Text
                          style={[
                            s.ownerState,
                            !staff.isAvailable && s.ownerStateOff,
                          ]}
                        >
                          {staff.isAvailable ? "Available" : "Unavailable"}
                        </Text>
                      </View>
                      <Text style={s.small}>
                        {staff.specialties || "Salon professional"}
                      </Text>
                      <Text style={s.small}>
                        {staff.email}
                        {staff.phone ? ` · ${staff.phone}` : ""}
                      </Text>
                      <View style={s.ownerInlineActions}>
                        <Pressable
                          onPress={() => {
                            setOwnerEditorError(null);
                            setOwnerEditor({
                              kind: "staff",
                              id: staff.id,
                              name: staff.name,
                              email: staff.email,
                              phone: staff.phone || "",
                              specialties: staff.specialties || "",
                              password: "",
                              isAvailable: staff.isAvailable,
                              imageUri: getApiAssetUrl(staff.imageUrl),
                              imageData: undefined,
                            });
                          }}
                          style={s.ownerEditAction}
                        >
                          <Ionicons
                            name="create-outline"
                            size={16}
                            color={C.rose}
                          />
                          <Text style={s.ownerEditActionText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          disabled={ownerRemoving === `staff-${staff.id}`}
                          onPress={() =>
                            confirmOwnerRemoval("staff", staff.id, staff.name)
                          }
                          style={s.ownerRemoveAction}
                        >
                          {ownerRemoving === `staff-${staff.id}` ? (
                            <ActivityIndicator size="small" color="#355C45" />
                          ) : (
                            <>
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#355C45"
                              />
                              <Text style={s.ownerRemoveActionText}>
                                Remove
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={40} color="#EDF5EE" />
                <Text style={s.cardTitle}>No staff profiles yet</Text>
                <Text style={s.small}>
                  Add a stylist profile to build your team.
                </Text>
              </View>
            )}
          </>
        );
      else if (page === "owner-profile")
        body = (
          <>
            <View style={s.ownerPageActions}>
              <View>
                <Text style={s.sectionTitle}>Customer-facing portfolio</Text>
                <Text style={s.small}>
                  Keep your public business details current.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const salon = ownerManagement.salon;
                  setOwnerEditorError(null);
                  setOwnerEditor({
                    kind: "profile",
                    name: salon.name,
                    description: salon.description || "",
                    address: salon.address,
                    city: salon.city,
                    phone: salon.phone || "",
                    website: salon.website || "",
                    openingTime: salon.openingTime?.slice(0, 5) || "",
                    closingTime: salon.closingTime?.slice(0, 5) || "",
                    imageUri: getApiAssetUrl(salon.profileImageUrl),
                    imageData: undefined,
                  });
                }}
                style={s.ownerAddButton}
              >
                <Ionicons name="create-outline" size={18} color={C.white} />
                <Text style={s.ownerAddButtonText}>Edit details</Text>
              </Pressable>
            </View>
            <View style={s.salonProfileHero}>
              <SalonLogo
                name={ownerManagement.salon.name}
                imageUrl={ownerManagement.salon.profileImageUrl}
                large
              />
              <View style={s.salonHeroContent}>
                <Text style={s.salonProfileName}>
                  {ownerManagement.salon.name}
                </Text>
                <Text style={s.salonHeroAddress}>
                  {ownerManagement.salon.address}, {ownerManagement.salon.city}
                </Text>
                <View style={s.salonRatingRow}>
                  <Ionicons name="star" size={18} color="#6F946E" />
                  <Text style={s.salonRatingText}>
                    {Number(ownerManagement.salon.rating).toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={s.ownerProfileGrid}>
              {[
                ["Phone", ownerManagement.salon.phone || "Not provided"],
                ["Website", ownerManagement.salon.website || "Not provided"],
                [
                  "Opening time",
                  ownerManagement.salon.openingTime || "Not provided",
                ],
                [
                  "Closing time",
                  ownerManagement.salon.closingTime || "Not provided",
                ],
              ].map((item) => (
                <View style={s.salonInfoCard} key={item[0]}>
                  <Text style={s.salonInfoLabel}>{item[0]}</Text>
                  <Text style={s.salonInfoValue}>{item[1]}</Text>
                </View>
              ))}
            </View>
            <View style={s.salonAbout}>
              <Text style={s.salonSectionKicker}>ABOUT</Text>
              <Text style={s.body}>
                {ownerManagement.salon.description ||
                  "No salon description has been added."}
              </Text>
            </View>
            <View style={s.ownerPageActions}>
              <View>
                <Text style={s.sectionTitle}>Portfolio gallery</Text>
                <Text style={s.small}>
                  {ownerManagement.portfolioImages.length}/12 photos
                </Text>
              </View>
              <Pressable
                disabled={ownerRemoving === "portfolio-add"}
                onPress={() => void addPortfolioPhoto()}
                style={s.ownerAddButton}
              >
                {ownerRemoving === "portfolio-add" ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={18} color={C.white} />
                    <Text style={s.ownerAddButtonText}>Add photo</Text>
                  </>
                )}
              </Pressable>
            </View>
            {ownerManagement.portfolioImages.length ? (
              <View style={s.ownerPortfolioGrid}>
                {ownerManagement.portfolioImages.map((image) => (
                  <View style={s.ownerPortfolioCard} key={image.id}>
                    <Image
                      source={{ uri: getApiAssetUrl(image.imageUrl)! }}
                      style={s.ownerPortfolioImage}
                    />
                    <Pressable
                      onPress={() =>
                        confirmMediaRemoval("portfolio photo", image.id)
                      }
                      style={s.ownerPortfolioRemove}
                    >
                      <Ionicons name="trash" size={17} color={C.white} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="images-outline" size={38} color="#EDF5EE" />
                <Text style={s.cardTitle}>No portfolio photos yet</Text>
                <Text style={s.small}>
                  Show customers your salon, team, and finished work.
                </Text>
              </View>
            )}
          </>
        );
      else
        body = ownerManagement.reviews.length ? (
          <View style={s.reviewList}>
            {ownerManagement.reviews.map((review) => (
              <View style={s.reviewCard} key={review.id}>
                <View style={s.reviewTop}>
                  <View style={s.reviewAvatar}>
                    <Text style={s.reviewInitial}>
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.salonCardGrow}>
                    <Text style={s.cardTitle}>{review.reviewerName}</Text>
                    <Text style={s.small}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={s.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.rating ? "star" : "star-outline"}
                        size={15}
                        color={C.gold}
                      />
                    ))}
                  </View>
                </View>
                {review.imageUrl && (
                  <Image
                    source={{ uri: getApiAssetUrl(review.imageUrl)! }}
                    style={s.reviewPhoto}
                  />
                )}
                {review.comment && (
                  <Text style={s.reviewComment}>{review.comment}</Text>
                )}
                {review.replies.map((reply) => (
                  <View style={s.salonOwnerReply} key={reply.id}>
                    <View style={s.salonOwnerReplyHead}>
                      <Ionicons name="storefront" size={16} color={C.rose} />
                      <Text style={s.salonOwnerReplyLabel}>
                        YOUR REPLY ·{" "}
                        {new Date(reply.createdAt).toLocaleString()}
                      </Text>
                      <Pressable
                        onPress={() => confirmMediaRemoval("reply", reply.id)}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color="#355C45"
                        />
                      </Pressable>
                    </View>
                    {reply.imageUrl && (
                      <Image
                        source={{ uri: getApiAssetUrl(reply.imageUrl)! }}
                        style={s.replyPhoto}
                      />
                    )}
                    {reply.message && (
                      <Text style={s.salonOwnerReplyText}>{reply.message}</Text>
                    )}
                  </View>
                ))}
                <Pressable
                  onPress={() => {
                    setOwnerEditorError(null);
                    setOwnerEditor({
                      kind: "reply",
                      reviewId: review.id,
                      reviewerName: review.reviewerName,
                      message: "",
                      imageUri: null,
                      imageData: undefined,
                    });
                  }}
                  style={s.ownerReplyButton}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={17}
                    color={C.rose}
                  />
                  <Text style={s.ownerReplyButtonText}>Add another reply</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.empty}>
            <Ionicons name="star-outline" size={40} color="#EDF5EE" />
            <Text style={s.cardTitle}>No reviews yet</Text>
            <Text style={s.small}>
              Client reviews for your salon will appear here.
            </Text>
          </View>
        );
    }
    return (
      <ScreenFrame>
        <Header title={title} onBack={() => setScreen("owner-dashboard")} />
        <View style={s.ownerSalonStrip}>
          <SalonLogo
            name={ownerManagement?.salon.name || "Teves Salon & Spa"}
            imageUrl={ownerManagement?.salon.profileImageUrl}
          />
          <View style={s.salonCardGrow}>
            <Text style={s.cardTitle}>
              {ownerManagement?.salon.name || "Teves Salon & Spa"}
            </Text>
          </View>
          {ownerManagementLoading && ownerManagement && (
            <ActivityIndicator size="small" color={C.rose} />
          )}
        </View>
        {page === "owner-bookings" && <BookingStatusFilters value={ownerBookingFilter} onChange={setOwnerBookingFilter} bookings={ownerManagement?.bookings || []} />}
        {body}
      </ScreenFrame>
    );
  };

  const rolePage = (role: "stylist" | "owner", page: string) => {
    const owner = role === "owner";
    const nav: {
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      target: Screen;
    }[] = owner
      ? [
          {
            label: "Manage booking requests",
            icon: "calendar",
            target: "owner-bookings",
          },
          {
            label: "Services & pricing",
            icon: "pricetag",
            target: "owner-services",
          },
          {
            label: "Staff & specializations",
            icon: "people",
            target: "owner-staff",
          },
          {
            label: "Business profile & portfolio",
            icon: "business",
            target: "owner-profile",
          },
          { label: "Reviews & ratings", icon: "star", target: "owner-reviews" },
        ]
      : [
          {
            label: "Upcoming appointments",
            icon: "calendar",
            target: "stylist-appointments",
          },
          {
            label: "Client appointment detail",
            icon: "person",
            target: "stylist-detail",
          },
          {
            label: "Availability & service status",
            icon: "toggle",
            target: "stylist-status",
          },
          {
            label: "Notifications",
            icon: "notifications",
            target: "stylist-notifications",
          },
        ];

    if (owner && page.includes("Dashboard")) {
      if (authToken && ownerDashboardError?.includes("No salon is linked")) {
        return (
          <ScreenFrame stickyHeader={false}>
            <OwnerSalonSetupScreen
              token={authToken}
              defaultName={authUser?.fullName || ""}
              defaultAddress={salonAddress}
              defaultCity={salonCity}
              defaultLatitude={salonLatitude}
              defaultLongitude={salonLongitude}
              defaultLogoUri={salonLogoUri}
              defaultLogoData={salonLogoData}
              onComplete={() => {
                setOwnerDashboardError(null);
                void Promise.all([loadOwnerDashboard(), loadSalons()]);
              }}
              onLogout={logout}
            />
          </ScreenFrame>
        );
      }
      return (
        <ScreenFrame scroll={false} stickyHeader={false}>
          <OwnerDashboardScreen
            scrollRequest={ownerScrollRequest}
            onSectionChange={setOwnerTab}
            dashboard={ownerDashboard}
            user={authUser}
            loading={ownerDashboardLoading}
            error={ownerDashboardError}
            unreadNotifications={notificationUnreadCount}
            desktop={isDesktopWeb}
            onNotifications={() => setScreen("owner-notifications")}
            onNavigate={(destination) => { setOwnerTab("manage"); setOwnerScrollRequest(previous => ({ tab: "manage", id: previous.id + 1 })); setScreen(destination); }}
            onReload={() => void loadOwnerDashboard()}
            onLogout={logout}
          />
        </ScreenFrame>
      );
    }

    const dashboardStats = owner
      ? [
          [String(ownerDashboard?.todayBookings ?? 0), "Today"],
          [String(ownerDashboard?.pendingBookings ?? 0), "Pending"],
          [(ownerDashboard?.rating ?? 0).toFixed(1), "Rating"],
        ]
      : [
          ["4", "Today"],
          ["2", "Confirmed"],
          ["4.9", "Rating"],
        ];
    return (
      <ScreenFrame>
        <Header
          title={page}
          onBack={() =>
            page.includes("Dashboard")
              ? setScreen("profile")
              : setScreen(owner ? "owner-dashboard" : "stylist-dashboard")
          }
        />
        {page.includes("Dashboard") && (
          <>
            {owner && ownerDashboardLoading ? (
              <ActivityIndicator color={C.rose} style={s.dataLoader} />
            ) : owner && ownerDashboardError ? (
              <Pressable
                onPress={() => void loadOwnerDashboard()}
                style={s.dataState}
              >
                <Text style={s.cardTitle}>Could not load salon dashboard</Text>
                <Text style={s.small}>
                  {ownerDashboardError} · Tap to retry
                </Text>
              </Pressable>
            ) : (
              <>
                <Text style={s.greeting}>
                  {owner
                    ? ownerDashboard?.name || authUser?.fullName || "Your salon"
                    : "Hi, Aya"}
                </Text>
                <Text style={s.body}>
                  {owner
                    ? "Here’s how your salon is doing today."
                    : "You have 4 clients on your schedule."}
                </Text>
                <View style={s.stats}>
                  {dashboardStats.map((x) => (
                    <View style={s.stat} key={x[1]}>
                      <Text style={s.statValue}>{x[0]}</Text>
                      <Text style={s.small}>{x[1]}</Text>
                    </View>
                  ))}
                </View>
                {owner && ownerDashboard && (
                  <Text style={s.small}>
                    {ownerDashboard.serviceCount} services ·{" "}
                    {ownerDashboard.availableStaff} available staff ·{" "}
                    {ownerDashboard.reviewCount} reviews
                  </Text>
                )}
              </>
            )}
          </>
        )}
        {page.includes("Dashboard") ? (
          nav.map((x) => (
            <Pressable
              onPress={() => setScreen(x.target)}
              style={s.menuRow}
              key={x.label}
            >
              <View style={s.menuIcon}>
                <Ionicons name={x.icon} size={21} color={C.rose} />
              </View>
              <Text style={[s.cardTitle, { flex: 1 }]}>{x.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </Pressable>
          ))
        ) : (
          <>
            <View style={s.bookingCard}>
              <Text style={s.eyebrow}>
                {owner ? "SALON MANAGEMENT" : "UPCOMING • 1:00 PM"}
              </Text>
              <Text style={s.title}>{owner ? page : "Mia Torres"}</Text>
              <Text style={s.body}>
                {owner
                  ? "Review and update your salon information."
                  : "Oval face • Wavy, medium hair • Soft Layered Lob"}
              </Text>
              <Art height={150} quadrant={0} />
              <View style={s.chipRow}>
                <View style={s.chip}>
                  <Text style={s.chipText}>
                    {owner ? "Active" : "AI recommendation attached"}
                  </Text>
                </View>
              </View>
            </View>
            {owner && page === "Booking requests" && (
              <View style={s.roleRow}>
                <Button label="Approve" onPress={() => {}} />
                <Button label="Decline" onPress={() => {}} secondary />
              </View>
            )}
            <Button
              label={
                page.includes("Services")
                  ? "Add service"
                  : page.includes("Staff")
                    ? "Add hairstylist"
                    : "Update status"
              }
              onPress={() => {}}
            />
          </>
        )}
      </ScreenFrame>
    );
  };

  let content: React.ReactNode;
  if (screen === "splash")
    content = (
      <ScreenFrame scroll={false}>
        <View style={s.splash}>
          <View style={s.logo}>
            <Image
              accessibilityLabel="hAIrfit logo"
              source={faceFitLogo}
              resizeMode="contain"
              style={s.splashLogoImage}
            />
          </View>
          <Text style={s.splashTagline}>Your style, thoughtfully matched.</Text>
          <View style={s.splashLoading}>
            <ActivityIndicator color={C.rose} />
            <Text style={s.splashLoadingText}>Getting your style studio ready</Text>
          </View>
        </View>
      </ScreenFrame>
    );
  else if (screen === "onboarding")
    content = (
      <ScreenFrame scroll={false}>
        <OnboardingScreen
          onGetStarted={() => setScreen("signup")}
          onLogin={() => setScreen("login")}
          onGuest={() => void startGuestScan()}
        />
      </ScreenFrame>
    );
  else if (screen === "login") content = auth(false);
  else if (screen === "signup") content = auth(true);
  else if (screen === "consent")
    content = (
      <ScreenFrame>
        <Header
          title="Terms & Conditions"
          onBack={() => setScreen(consentReturnScreen)}
        />
        <View style={s.consentHero}>
          <View style={s.consentHeroTop}>
            <Text style={s.consentKicker}>TERMS & PRIVACY</Text>
            <View style={s.consentShield}>
              <Ionicons name="shield-checkmark" size={23} color={C.roseDark} />
            </View>
          </View>
          <Text style={s.consentHeroTitle}>Your data. Your choice.</Text>
          <Text style={s.consentHeroCopy}>
            Review how hAIrfit uses your scan photo and location before you continue.
          </Text>
        </View>
        <Text style={s.eyebrow}>IN PLAIN LANGUAGE</Text>
        {[
          [
            "scan-outline",
            "Face analysis",
            "A photo you provide helps hAIrfit estimate your face shape and recommend hairstyles.",
          ],
          [
            "location-outline",
            "Nearby salons",
            "Your location is used while hAIrfit is open to help find salons close to you.",
          ],
          [
            "images-outline",
            "Your choice of photo",
            "Use the camera for a guided scan or choose a photo from your gallery.",
          ],
        ].map((x) => (
          <View style={s.consentRow} key={x[0]}>
            <View style={s.consentRowIcon}>
              <Ionicons
                name={x[0] as keyof typeof Ionicons.glyphMap}
                size={21}
                color={C.rose}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{x[1]}</Text>
              <Text style={s.small}>{x[2]}</Text>
            </View>
          </View>
        ))}
        <View style={s.consentSectionHeading}>
          <Text style={s.sectionTitle}>Your permissions</Text>
          <Text style={s.small}>Choose each permission to continue.</Text>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: faceAnalysisConsent }}
          onPress={() => setFaceAnalysisConsent((value) => !value)}
          style={({ pressed }) => [
            s.checkRow,
            faceAnalysisConsent && s.checkRowActive,
            pressed && s.pressed,
          ]}
        >
          <View style={[s.consentCheck, faceAnalysisConsent && s.consentCheckActive]}>
            {faceAnalysisConsent && <Ionicons name="checkmark" size={16} color={C.white} />}
          </View>
          <View style={s.consentCheckCopy}>
            <Text style={s.consentCheckTitle}>Face analysis</Text>
            <Text style={s.small}>
              I agree that a photo I provide may be analyzed to estimate my face shape and recommend hairstyles.
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: locationConsent }}
          onPress={() => setLocationConsent((value) => !value)}
          style={({ pressed }) => [
            s.checkRow,
            s.locationCheckRow,
            locationConsent && s.checkRowActive,
            pressed && s.pressed,
          ]}
        >
          <View style={[s.consentCheck, locationConsent && s.consentCheckActive]}>
            {locationConsent && <Ionicons name="checkmark" size={16} color={C.white} />}
          </View>
          <View style={s.consentCheckCopy}>
            <Text style={s.consentCheckTitle}>Location while using hAIrfit</Text>
            <Text style={s.small}>
              I agree to location access while the app is open so hAIrfit can show nearby salons.
            </Text>
          </View>
        </Pressable>
        <View style={s.consentNotice}>
          <Ionicons name="information-circle-outline" size={19} color={C.roseDark} />
          <Text style={s.consentNoticeText}>
            Saved on this device for your hAIrfit account, so you won’t be asked again the next time you log in here.
          </Text>
        </View>
        {consentError && <Text accessibilityRole="alert" style={s.consentError}>{consentError}</Text>}
        <Button
          label={consentSaving ? "Saving your agreement..." : "Agree & continue"}
          disabled={!faceAnalysisConsent || !locationConsent || consentSaving}
          onPress={() => void acceptConsent()}
        />
      </ScreenFrame>
    );
  else if (screen === "home") content = home;
  else if (screen === "scan") content = scan;
  else if (screen === "processing") content = processing;
  else if (screen === "result") content = result;
  else if (screen === "recommendations") content = recommendations;
  else if (screen === "style-detail") content = styleDetail;
  else if (screen === "salons") content = salons;
  else if (screen === "salon-detail") content = salonDetail;
  else if (screen === "service") content = selection("service");
  else if (screen === "stylist") content = selection("stylist");
  else if (screen === "datetime") content = datetime;
  else if (screen === "summary") content = summary;
  else if (screen === "success") content = success;
  else if (screen === "bookings") content = bookings;
  else if (screen === "profile") content = profile;
  else if (screen === "saved")
    content = accountPage("Saved hairstyles", "saved");
  else if (screen === "saved-style-detail") content = savedStyleDetail;
  else if (screen === "saved-salons")
    content = accountPage("Saved salons", "saved-salons");
  else if (screen === "notifications") content = notificationPage(false);
  else if (screen === "reviews") content = accountPage("My reviews", "reviews");
  else if (screen === "settings") content = settingsPage;
  else if (screen.startsWith("stylist-") && authToken && authUser?.role === "stylist")
    content = <StylistDashboardScreen token={authToken} user={authUser} onLogout={logout}/>;
  else if (screen === "stylist-appointments")
    content = rolePage("stylist", "Appointments");
  else if (screen === "stylist-detail")
    content = rolePage("stylist", "Appointment detail");
  else if (screen === "stylist-status")
    content = rolePage("stylist", "Service & availability");
  else if (screen === "stylist-notifications")
    content = rolePage("stylist", "Notifications");
  else if (screen === "owner-dashboard")
    content = rolePage("owner", "Owner Dashboard");
  else if (screen === "owner-notifications") content = notificationPage(true);
  else if (screen.startsWith("owner-"))
    content = ownerManagementPage(
      screen as Exclude<Screen, "owner-dashboard" | "owner-notifications">,
    );
  else content = rolePage("owner", "Reviews & ratings");

  const showAppNavigation =
    mainScreens.includes(screen) ||
    [
      "salons",
      "salon-detail",
      "service",
      "stylist",
      "datetime",
      "summary",
      "success",
      "saved",
      "saved-style-detail",
      "saved-salons",
      "notifications",
      "reviews",
      "settings",
    ].includes(screen);
  return (
    <KeyboardAvoidingView
      style={s.app}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style={screen === "scan" ? "light" : "dark"} />
      <View style={[s.appViewport, isDesktopWeb && s.appViewportDesktop]}>
        {isDesktopWeb && showAppNavigation && !isGuestAccount && (
          <DesktopNavigation screen={screen} go={setScreen} onLogout={logout} />
        )}
        <View style={s.contentViewport}>{content}</View>
      </View>
      {!isDesktopWeb && screen === 'salon-detail' && selectedSalon && !salonDetailLoading && (
        <SafeAreaView edges={['bottom']} style={s.salonSectionFooter}>
          <View style={s.salonSectionTabs} accessibilityRole="tablist">
            {([
              { name: 'Services' as const, count: salonServices.length, icon: 'cut-outline' as const },
              { name: 'Staff' as const, count: salonStaff.length, icon: 'people-outline' as const },
              { name: 'Reviews' as const, count: salonReviewSummary.count, icon: 'star-outline' as const },
            ]).map(tab => <Pressable key={tab.name} accessibilityRole="tab" accessibilityState={{ selected: salonDetailTab === tab.name }} onPress={() => setSalonDetailTab(tab.name)} style={[s.salonSectionTab, salonDetailTab === tab.name && s.salonSectionTabActive]}><Ionicons name={tab.icon} size={17} color={salonDetailTab === tab.name ? C.white : C.rose}/><Text style={[s.salonSectionTabText, salonDetailTab === tab.name && s.salonSectionTabTextActive]}>{tab.name}</Text><Text style={[s.salonSectionTabCount, salonDetailTab === tab.name && s.salonSectionTabTextActive]}>{tab.count}</Text></Pressable>)}
          </View>
        </SafeAreaView>
      )}
      {!isDesktopWeb &&
        (mainScreens.includes(screen) || screen === "settings") &&
        ![
          "scan",
          "processing",
          "result",
          "recommendations",
          "style-detail",
        ].includes(screen) && (
          <View style={s.tabShell}>
            <TabBar screen={screen} go={setScreen} />
          </View>
        )}
      {authUser?.role === "owner" && screen.startsWith("owner-") && !ownerDashboardError?.includes("No salon is linked") && (
        <OwnerTabBar active={screen === "owner-dashboard" || screen === "owner-notifications" ? ownerTab : "manage"}
          onChange={(tab) => { setOwnerTab(tab); setOwnerScrollRequest(previous => ({ tab, id: previous.id + 1 })); setScreen("owner-dashboard"); }} />
      )}
      <Modal
        visible={mapVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMapVisible(false)}
      >
        <SafeAreaView style={s.mapModal}>
          <View style={s.mapHeader}>
            <View>
              <Text style={s.mapTitle}>Your location</Text>
              <Text style={s.small}>
                Explore salons around your current position
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close map"
              onPress={() => setMapVisible(false)}
              style={s.mapClose}
            >
              <Ionicons name="close" size={24} color={C.ink} />
            </Pressable>
          </View>
          {currentLocation && (
            <LocationMap
              coordinate={currentLocation}
              salons={mappedSalons}
              onSelectSalon={(salonId) => {
                const salon = salonRecords.find((item) => item.id === salonId);
                if (salon) {
                  setMapVisible(false);
                  void openSalon(salon, "nearby-map");
                }
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
      <Modal transparent animationType="slide" visible={!!quickProfileStylist} onRequestClose={() => setQuickProfileStylist(null)}>
        <Pressable style={s.staffModalBackdrop} onPress={() => setQuickProfileStylist(null)}>
          <Pressable style={[s.staffModalSheet, { maxHeight: '82%' }]} onPress={event => event.stopPropagation()}>
            <View style={s.staffModalHandle}/>
            <View style={s.staffModalHeader}><View style={s.salonCardGrow}><Text style={s.eyebrow}>STYLIST PROFILE</Text><Text style={s.title}>{quickProfileStylist?.name}</Text><Text style={s.small}>{quickProfileStylist?.specialties || 'Salon professional'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close stylist profile" onPress={() => setQuickProfileStylist(null)} style={s.iconButton}><Ionicons name="close" size={22} color={C.ink}/></Pressable></View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: C.blush }}><View style={s.staffModalAvatarFallback}><Text style={s.staffInitial}>{quickProfileStylist?.name.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{quickProfileStylist?.name}</Text><Text style={s.small}>{quickProfileStylist?.specialties || 'Experienced salon stylist'}</Text></View><View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: C.roseDark }}>{Number(quickProfileStylist?.averageRating || 0).toFixed(1)} ★</Text><Text style={s.small}>{quickProfileStylist?.reviewCount || 0} reviews</Text></View></View>
              <Text style={s.sectionTitle}>Client feedback</Text>
              {quickProfileStylist?.reviews?.length ? quickProfileStylist.reviews.map((review, index) => <View key={`${index}-${review.createdAt}`} style={{ padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, gap: 7 }}><Text style={{ color: C.gold, fontSize: 13, letterSpacing: 2 }}>{'★'.repeat(Number(review.rating))}{'☆'.repeat(5 - Number(review.rating))}</Text><Text style={s.cardTitle}>{review.customerName}</Text>{review.comment ? <Text style={s.body}>{review.comment}</Text> : <Text style={s.small}>No written comment.</Text>}<Text style={s.small}>{new Date(review.createdAt).toLocaleDateString()}</Text></View>) : <View style={{ alignItems: 'center', padding: 24, borderRadius: 16, backgroundColor: C.white, gap: 8 }}><Ionicons name="chatbubble-ellipses-outline" size={28} color={C.rose}/><Text style={s.cardTitle}>No stylist reviews yet</Text><Text style={[s.small, { textAlign: 'center' }]}>Client feedback will appear here after completed appointments.</Text></View>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <OwnerEditorModal
        editor={ownerEditor}
        setEditor={setOwnerEditor}
        saving={ownerEditorSaving}
        error={ownerEditorError}
        onSave={() => void saveOwnerEditor()}
      />
      <ConfirmationPrompt
        prompt={confirmationPrompt}
        onDismiss={() => setConfirmationPrompt(null)}
      />
      <FavoriteToast toast={favoriteToast} onDismiss={dismissFavoriteToast} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, width: "100%", backgroundColor: "#FAFBF8" },
  appViewport: { flex: 1, width: "100%" },
  appViewportDesktop: {
    width: "100%",
    alignSelf: "stretch",
    flexDirection: "row",
    backgroundColor: "#FAFBF8",
  },
  contentViewport: { flex: 1, minWidth: 0, width: "100%" },
  webShell: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: "#FAFBF8",
    overflow: "hidden",
  },
  webShellWeb: { maxWidth: "100%", alignSelf: "stretch" },
  webShellDesktop: { maxWidth: "100%", alignSelf: "stretch" },
  safe: { flex: 1, width: "100%" },
  scroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 132 },
  scrollTablet: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 100 },
  scrollDesktop: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 72,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  desktopNavRail: { width: 76, height: "100%", zIndex: 5 },
  desktopNav: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: C.line,
    overflow: "hidden",
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 24, color: "rgba(53, 92, 69, 0.08)" }],
    elevation: 8,
    zIndex: 5,
  },
  desktopNavHoverArea: { flex: 1, paddingHorizontal: 14, paddingVertical: 28 },
  desktopBrand: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 38,
  },
  desktopBrandText: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: C.roseDark,
  },
  desktopNavLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#4A765A",
    marginLeft: 12,
    marginBottom: 10,
  },
  desktopNavItems: { gap: 7 },
  desktopNavItem: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  desktopNavIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  desktopNavItemActive: { backgroundColor: C.blush },
  desktopNavText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.muted,
    minWidth: 150,
  },
  desktopNavTextActive: { color: C.roseDark },
  header: {
    minHeight: 64,
    zIndex: 10,
    backgroundColor: "#FAFBF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  profileHeaderWrap: { zIndex: 20 },
  profileHeaderMenu: {
    position: "absolute",
    top: 56,
    right: 0,
    minWidth: 176,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(0, 0, 0, 0.12)" }],
    elevation: 8,
  },
  profileHeaderMenuItem: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: C.ink, letterSpacing: -0.35 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  notificationBadge: {
    position: "absolute",
    right: -5,
    top: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4A765A",
    borderWidth: 2,
    borderColor: C.white,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: { fontSize: 9, fontWeight: "900", color: C.white },
  notificationMenuCount: {
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#4A765A",
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButtonActive: { backgroundColor: C.blush, borderColor: "#EDF5EE" },
  favoritePressed: { transform: [{ scale: 0.9 }] },
  logoSmall: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImageSmall: { width: "100%", height: "100%", },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: C.ink, letterSpacing: -0.6 },
  display: {
    fontSize: 40,
    lineHeight: 47,
    fontWeight: "800",
    color: C.ink,
    marginBottom: 10,
  },
  body: { fontSize: 15, lineHeight: 23, color: C.muted, marginBottom: 20 },
  small: { fontSize: 13, lineHeight: 19, color: C.muted },
  lightSmall: { fontSize: 12, color: C.white, marginTop: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: C.rose,
    marginBottom: 8,
  },
  link: { color: C.rose, fontSize: 14, fontWeight: "700" },
  mutedLink: { color: C.muted, fontSize: 14, fontWeight: "700" },
  centerText: { textAlign: "center" },
  button: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: C.rose,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 14,
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(53, 92, 69, 0.16)" }],
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#E2E9E2",
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: "800", color: C.white },
  buttonTextSecondary: { color: C.rose },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.pale,
  },
  logo: {
    width: 244,
    height: 244,
    borderRadius: 76,
    backgroundColor: "#FAFBF8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 32, color: "rgba(74, 118, 90, 0.12)" }],
    elevation: 10,
  },
  splashLogoImage: { width: "100%", height: "100%", },
  splashTagline: { fontSize: 15, fontWeight: "700", color: C.roseDark, letterSpacing: -0.15, marginTop: 19 },
  splashLoading: { alignItems: "center", gap: 12, marginTop: 36 },
  splashLoadingText: { fontSize: 11, fontWeight: "700", color: C.muted },
  authSwitch: {
    textAlign: "center",
    color: C.roseDark,
    fontWeight: "700",
    fontSize: 14,
    marginTop: 22,
  },
  guestLoginButton: {
    minHeight: 52,
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  guestLoginText: { color: C.roseDark, fontSize: 14, fontWeight: "800" },
  authError: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#EDF5EE",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 4,
  },
  authErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#355C45",
    fontWeight: "600",
  },
  accountTypeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 10,
  },
  accountTypeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  accountTypeRowStacked: { flexDirection: "column" },
  accountTypeCard: {
    flex: 1,
    minHeight: 138,
    padding: 16,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    gap: 6,
  },
  accountTypeCardWeb: { minHeight: 128, padding: 18, borderRadius: 24, gap: 8 },
  accountTypeCardCompact: { minHeight: 116, padding: 15 },
  accountTypeCardActive: {
    borderWidth: 2,
    borderColor: C.rose,
    backgroundColor: "#FFFFFF",
  },
  accountTypeTitle: { fontSize: 14, fontWeight: "800", color: C.ink },
  accountTypeTitleActive: { color: C.roseDark },
  accountTypeCaption: { fontSize: 11, lineHeight: 16, color: C.muted },
  authIntro: { marginVertical: 15 },
  authContent: { width: "100%" },
  authContentDesktop: { maxWidth: 640, alignSelf: "center" },
  field: {
    height: 60,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 8, color: "rgba(53, 92, 69, 0.025)" }],
    elevation: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 13,
  },
  input: { flex: 1, fontSize: 15, color: C.ink, outlineStyle: "none" as never },
  ownerSignupSection: {
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  ownerSignupTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.ink,
    marginBottom: 5,
  },
  salonSignupLogoPicker: {
    minHeight: 84,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E2E9E2",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  salonSignupLogo: {
    width: 58,
    height: 58,
    borderRadius: 16,
    },
  salonSignupLogoFallback: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  coordinateRow: { flexDirection: "row", gap: 10 },
  coordinateField: { flex: 1, minWidth: 0 },
  consentHero: {
    minHeight: 205,
    borderRadius: 28,
    backgroundColor: C.blush,
    padding: 22,
    justifyContent: "space-between",
    marginBottom: 25,
    borderWidth: 1,
    borderColor: C.line,
  },
  consentHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  consentKicker: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: C.roseDark,
  },
  consentShield: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  consentHeroTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.45,
    color: C.ink,
  },
  consentHeroCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: C.roseDark,
    marginTop: 7,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  consentRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  consentSectionHeading: { marginTop: 17, marginBottom: 4 },
  checkRow: {
    minHeight: 90,
    padding: 16,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 12,
  },
  checkRowActive: { borderColor: C.rose, backgroundColor: "#FFFFFF" },
  consentCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  consentCheckActive: { backgroundColor: C.rose, borderColor: C.rose },
  consentCheckCopy: { flex: 1, gap: 4 },
  consentCheckTitle: { fontSize: 13, fontWeight: "900", color: C.ink },
  locationCheckRow: { marginTop: 10 },
  consentNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 13,
    borderRadius: 16,
    backgroundColor: C.blush,
    marginTop: 15,
  },
  consentNoticeText: { flex: 1, fontSize: 11, lineHeight: 17, color: C.roseDark },
  consentError: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.blush,
    color: C.roseDark,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  greeting: { fontSize: 28, fontWeight: "800", letterSpacing: -0.55, color: C.ink, marginBottom: 4 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    minHeight: 230,
    borderRadius: 30,
    backgroundColor: C.blush,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: C.line,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: C.roseDark,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    color: C.ink,
    maxWidth: 210,
  },
  heroButton: {
    marginTop: 20,
    alignSelf: "flex-start",
    height: 46,
    borderRadius: 16,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroButtonText: { fontSize: 13, fontWeight: "800", color: C.roseDark },
  faceMini: {
    position: "absolute",
    right: -20,
    bottom: -20,
    width: 130,
    height: 170,
    borderWidth: 2,
    borderColor: "#6F946E",
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: C.ink,
    marginVertical: 15,
  },
  sectionAction: {
    minWidth: 84,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  art: { width: "100%", borderRadius: 20, },
  artCrop: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.blush,
  },
  artSheet: { width: "200%", height: "200%", },
  q1: { transform: [{ translateX: "-50%" }] },
  q2: { transform: [{ translateY: "-50%" }] },
  q3: { transform: [{ translateX: "-50%" }, { translateY: "-50%" }] },
  overlayPill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(41,35,38,.85)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  overlayText: { color: C.white, fontSize: 12, fontWeight: "700" },
  hRow: { gap: 12, paddingRight: 10 },
  salonCard: {
    width: 174,
    padding: 11,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(53, 92, 69, 0.045)" }],
    elevation: 2,
  },
  salonThumb: {
    height: 104,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
    overflow: "hidden",
  },
  salonThumbImage: { width: "100%", height: "100%", },
  salonHeart: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 3 },
  tip: {
    marginTop: 25,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#EDF5EE",
    flexDirection: "row",
    gap: 12,
  },
  tabShell: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tabBar: {
    width: "100%",
    maxWidth: 430,
    height: 76,
    marginBottom: 8,
    paddingBottom: 7,
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 18, color: "rgba(53, 92, 69, 0.1)" }],
    elevation: 8,
  },
  tabBarWeb: { maxWidth: "100%" },
  tabItem: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 4 },
  scanTabItem: { justifyContent: "center", gap: 0 },
  scanTabButton: { width: 56, height: 56, marginTop: -20, marginBottom: 2, borderRadius: 19, backgroundColor: C.rose, borderWidth: 3, borderColor: C.white, alignItems: "center", justifyContent: "center", boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, color: "rgba(53, 92, 69, 0.3)" }], elevation: 9 },
  scanTabButtonActive: { backgroundColor: C.roseDark },
  scanSparkleOne: { position: "absolute", top: 7, right: 9 },
  scanSparkleTwo: { position: "absolute", bottom: 8, left: 9 },
  scanTabLabel: { marginTop: 2, color: C.roseDark, fontWeight: "800" },
  tabLabel: { fontSize: 10, fontWeight: "700", color: C.muted },
  tabActive: { color: C.rose, fontWeight: "800" },
  centerPage: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  processIcon: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  steps: {
    width: "100%",
    padding: 20,
    borderRadius: 20,
    backgroundColor: C.white,
    marginTop: 20,
  },
  step: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginVertical: 8,
  },
  stepDot: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#E2E9E2",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: C.green, borderColor: C.green },
  resultVisual: {
    height: 285,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 12,
    position: "relative",
  },
  resultContent: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    position: "relative",
  },
  resultDecorLayer: { position: "absolute", top: -100, bottom: 0, left: -350, right: -350, overflow: "visible" },
  resultDecorLeft: { position: "absolute", top: 260, left: -100, width: 590, height: 590, borderRadius: 295, backgroundColor: "#DDEBE0", opacity: 0.82 },
  resultDecorRight: { position: "absolute", top: -40, right: -110, width: 590, height: 590, borderRadius: 295, backgroundColor: "#E4EFE6", opacity: 0.9 },
  resultDecorAccent: { position: "absolute", top: "44%", left: -220, width: 550, height: 210, borderRadius: 150, backgroundColor: "#E1EEE3", opacity: 0.92, transform: [{ rotate: "18deg" }] },
  resultDecorLeaf: { position: "absolute", top: 350, right: -90, opacity: 0.38, transform: [{ rotate: "-24deg" }] },
  resultDecorSparkle: { position: "absolute", top: 135, left: -80, opacity: 0.42 },
  resultMatchesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    marginBottom: 14,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  resultMatchesIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  resultImage: { width: "100%", height: "100%", },
  outlineOval: {
    position: "absolute",
    width: 150,
    height: 210,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: C.white,
    alignSelf: "center",
    top: 34,
  },
  confidence: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 9,
  },
  confidenceText: { fontSize: 12, fontWeight: "800", color: C.green },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: {
    backgroundColor: C.blush,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: C.roseDark },
  chatBox: {
    height: 54,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#E2E9E2",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    marginBottom: 20,
  },
  chatInput: {
    flex: 1,
    fontSize: 13,
    color: C.ink,
    outlineStyle: "none" as never,
  },
  matchSectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.ink,
    marginTop: 8,
    marginBottom: 3,
  },
  matchSectionCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    marginBottom: 12,
  },
  recCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 14, color: "rgba(53, 92, 69, 0.05)" }],
    elevation: 2,
  },
  recBody: { padding: 14, paddingTop: 50 },
  matchBadge: {
    position: "absolute",
    top: 12,
    left: 14,
    backgroundColor: C.blush,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    zIndex: 1,
  },
  matchText: { fontSize: 12, fontWeight: "800", color: C.rose },
  detailTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
    gap: 16,
  },
  scoreCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: { fontSize: 18, fontWeight: "900", color: C.rose },
  salonSearch: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E9E1",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    gap: 12,
    marginBottom: 14,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 13, color: "rgba(22, 78, 53, 0.055)" }],
    elevation: 1,
  },
  salonSearchInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: C.ink,
    outlineStyle: "none" as never,
  },
  searchClear: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  salonListingHero: {
    height: 188,
    borderRadius: 24,
    marginBottom: 18,
    overflow: "hidden",
    backgroundColor: "#315E45",
    position: "relative",
    justifyContent: "flex-end",
    boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 20, color: "rgba(22, 78, 53, 0.12)" }],
    elevation: 2,
  },
  salonListingHeroCompact: { height: 168, borderRadius: 20 },
  salonListingHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  salonListingHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 45, 31, 0.48)",
  },
  salonListingHeroContent: { paddingHorizontal: 22, paddingBottom: 20, gap: 5 },
  salonLocationPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.19)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  salonLocationText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  salonListingHeroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  salonListingHeroSubtitle: {
    color: "rgba(255,255,255,0.91)",
    fontSize: 14,
    lineHeight: 20,
  },
  salonControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  salonFilterButton: {
    minHeight: 43,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7E4D8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  salonFilterButtonActive: { backgroundColor: "#164E35", borderColor: "#164E35" },
  salonFilterButtonText: { color: "#315E45", fontSize: 13, fontWeight: "800" },
  salonFilterButtonTextActive: { color: "#FFFFFF" },
  salonViewToggle: {
    flex: 1,
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  salonViewItem: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  salonViewActive: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EAF3EC",
  },
  salonViewItemText: { color: "#718078", fontSize: 13, fontWeight: "700" },
  salonViewActiveText: { color: "#164E35", fontSize: 13, fontWeight: "800" },
  salonResultCount: {
    color: "#718078",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    marginLeft: 2,
  },
  clearSearchButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: {
    height: 48,
    borderRadius: 15,
    backgroundColor: "#F4F7F2",
    padding: 4,
    flexDirection: "row",
    marginBottom: 17,
  },
  segmentActive: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  segmentText: { fontSize: 13, fontWeight: "800", color: C.rose },
  mapMock: {
    height: 150,
    borderRadius: 22,
    backgroundColor: "#F4F7F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    overflow: "hidden",
  },
  pin: {
    position: "absolute",
    top: 25,
    right: 80,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  listCardClosed: { backgroundColor: "#F4F7F2", borderColor: "#E2E9E2" },
  salonDiscoveryCard: {
    minHeight: 136,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAE3",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 13,
    boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 16, color: "rgba(22, 78, 53, 0.065)" }],
    elevation: 2,
  },
  salonCardPressed: { transform: [{ scale: 0.992 }], opacity: 0.96 },
  salonDiscoveryImage: {
    width: 88,
    height: 100,
    borderRadius: 15,
    backgroundColor: "#EAF3EC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  salonDiscoveryImageCompact: { width: 68, height: 82, borderRadius: 13 },
  salonDiscoveryInfo: { flex: 1, minWidth: 0, alignSelf: "stretch", justifyContent: "center", gap: 4 },
  salonDiscoveryName: { color: "#263B30", fontSize: 16, lineHeight: 21, fontWeight: "800", marginBottom: 2 },
  salonDiscoveryMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  salonDiscoveryMetaText: { flex: 1, minWidth: 0, color: "#718078", fontSize: 12, lineHeight: 17 },
  salonDiscoveryBadges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 3 },
  salonRatingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  salonRatingText: { color: "#594A32", fontSize: 12, fontWeight: "800" },
  salonReviewCountText: { color: "#718078", fontSize: 11, fontWeight: "600" },
  salonStatusBadge: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  salonStatusOpen: { backgroundColor: "#EAF3EC" },
  salonStatusClosed: { backgroundColor: "#F2F1EC" },
  salonStatusDot: { width: 6, height: 6, borderRadius: 3 },
  salonStatusDotOpen: { backgroundColor: "#4F8A5B" },
  salonStatusDotClosed: { backgroundColor: "#A08055" },
  salonStatusText: { color: "#315E45", fontSize: 10, fontWeight: "800", flexShrink: 1 },
  salonStatusTextClosed: { color: "#765D3C" },
  salonNoMapBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99, backgroundColor: "#F1F4F1" },
  salonNoMapText: { color: "#718078", fontSize: 10, fontWeight: "700" },
  salonDetailsLink: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, paddingVertical: 3 },
  salonDetailsLinkText: { color: "#164E35", fontSize: 12, fontWeight: "800" },
  salonDiscoveryActions: { alignItems: "center", justifyContent: "center", gap: 9 },
  salonClosedDim: { opacity: 0.5 },
  closedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "#EDF5EE",
  },
  closedBadgeText: { fontSize: 11, fontWeight: "800", color: "#355C45" },
  privacyCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.blush,
    borderWidth: 1,
    borderColor: "#E2E9E2",
    marginBottom: 6,
  },
  privacyCalloutTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: C.roseDark,
    marginBottom: 6,
  },
  privacyHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: C.ink,
    marginTop: 16,
    marginBottom: 5,
  },
  privacyText: { fontSize: 13, lineHeight: 20, color: C.muted },
  listCard: {
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  listFavorite: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.pale,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  salonSquare: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  salonSquareImage: { width: "100%", height: "100%", },
  mapModal: { flex: 1, backgroundColor: C.pale },
  mapHeader: {
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapTitle: { fontSize: 19, fontWeight: "800", color: C.ink, marginBottom: 2 },
  mapClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.pale,
    borderWidth: 1,
    borderColor: C.line,
  },
  mapNotice: {
    marginTop: 12,
    padding: 14,
    borderRadius: 15,
    backgroundColor: C.blush,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mapAttribution: {
    fontSize: 10,
    color: C.muted,
    textAlign: "right",
    marginTop: 7,
  },
  dataLoader: { marginVertical: 32 },
  dataState: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    gap: 5,
    marginBottom: 16,
  },
  salonHero: {
    height: 280,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 14,
  },
  salonHeroShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(40,25,30,.62)",
  },
  salonHeroTitle: { fontSize: 23, fontWeight: "800", color: C.white },
  serviceRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stylistMini: {
    width: 112,
    padding: 12,
    borderRadius: 18,
    backgroundColor: C.white,
  },
  stylistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quote: {
    fontSize: 15,
    lineHeight: 23,
    fontStyle: "italic",
    color: C.muted,
    backgroundColor: C.white,
    padding: 17,
    borderRadius: 17,
  },
  salonIdentity: {
    minHeight: 245,
    borderRadius: 24,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    marginBottom: 16,
  },
  salonIdentityName: {
    fontSize: 24,
    fontWeight: "900",
    color: C.roseDark,
    textAlign: "center",
  },
  salonLogo: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.rose,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    marginBottom: 12,
  },
  salonLogoImage: { },
  salonLogoLarge: {
    width: 104,
    height: 104,
    borderRadius: 32,
    marginBottom: 5,
  },
  salonLogoText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: C.white,
  },
  salonLogoTextLarge: { fontSize: 16 },
  salonProfileHero: {
    minHeight: 236,
    borderRadius: 30,
    backgroundColor: C.blush,
    padding: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
  },
  salonHeroContent: { flex: 1, gap: 7 },
  salonProfileName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: C.ink,
  },
  salonRatingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  salonRatingText: { fontSize: 16, fontWeight: "900", color: C.ink },
  salonHeroMeta: { fontSize: 12, fontWeight: "600", color: C.roseDark },
  salonHeroAddress: { fontSize: 13, lineHeight: 19, color: C.roseDark },
  salonInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  salonInfoCard: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? 180 : 100,
    minHeight: 116,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 4,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  salonInfoLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.muted,
  },
  salonInfoValue: { fontSize: 13, fontWeight: "800", color: C.ink },
  salonAbout: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#EDF5EE",
    marginBottom: 8,
  },
  salonSectionKicker: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: C.rose,
    marginBottom: 7,
  },
  salonLoadWarning: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EDF5EE",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },
  salonSectionTabs: { flexDirection: "row", gap: 7, padding: 5, borderRadius: 17, backgroundColor: "#EDF5EE", marginTop: 8 },
  salonSectionFooter: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 12, paddingTop: 8 },
  stylistFeedbackCard: { marginTop: 14, padding: 16, borderRadius: 19, backgroundColor: C.pale, borderWidth: 1, borderColor: C.line, gap: 12 },
  stylistFeedbackSent: { backgroundColor: '#EAF4EA', borderColor: '#C9DEC9' },
  stylistFeedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  stylistFeedbackIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: C.rose, alignItems: 'center', justifyContent: 'center' },
  stylistFeedbackIconPending: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#DCEBDD', alignItems: 'center', justifyContent: 'center' },
  stylistFeedbackTitle: { color: C.roseDark, fontSize: 15, fontWeight: '800' },
  stylistFeedbackSub: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  stylistFeedbackInput: { width: '100%', minHeight: 78, marginTop: 2, padding: 13, borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.white, color: C.ink, textAlignVertical: 'top' },
  stylistFeedbackQuote: { padding: 14, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: '#DDE9DC', gap: 8 },
  stylistFeedbackQuoteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stylistFeedbackStars: { color: C.gold, fontSize: 16, letterSpacing: 2 },
  stylistFeedbackYourRating: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  stylistFeedbackQuoteText: { color: C.ink, fontSize: 13, lineHeight: 20 },
  salonSectionTab: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 13, paddingHorizontal: 7 },
  salonSectionTabActive: { backgroundColor: C.rose },
  salonSectionTabText: { color: C.roseDark, fontSize: 12, fontWeight: "700" },
  salonSectionTabTextActive: { color: C.white },
  salonSectionTabCount: { color: C.muted, fontSize: 10, fontWeight: "700" },
  salonDetailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  salonServiceCard: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? 280 : "100%",
    minHeight: 120,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  salonServiceIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  salonCardGrow: { flex: 1, minWidth: 0 },
  salonServiceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  salonPrice: { fontSize: 15, fontWeight: "900", color: C.roseDark },
  salonEmptyCard: {
    minHeight: 88,
    borderRadius: 19,
    backgroundColor: C.white,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E2E9E2",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  staffCard: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? 280 : "100%",
    minHeight: 106,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  staffCardSelected: {
    borderWidth: 2,
    borderColor: C.rose,
    backgroundColor: "#FFFFFF",
  },
  staffAvatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: C.roseDark,
    alignItems: "center",
    justifyContent: "center",
  },
  staffAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: C.blush,
  },
  staffAvatarSelected: { backgroundColor: C.rose },
  staffInitial: { fontSize: 20, fontWeight: "900", color: C.white },
  availableBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "#EDF5EE",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  availableText: { fontSize: 10, fontWeight: "800", color: C.green },
  portfolioGallery: { gap: 12, paddingBottom: 4 },
  portfolioCustomerCard: {
    width: 250,
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  portfolioCustomerImage: { width: "100%", height: 170, },
  portfolioCaption: {
    padding: 11,
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
  },
  reviewHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewSummaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "#EDF5EE",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  reviewSummaryText: { fontSize: 11, fontWeight: "800", color: C.ink },
  reviewList: { gap: 10 },
  reviewCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewInitial: { fontSize: 16, fontWeight: "900", color: C.roseDark },
  reviewStars: { flexDirection: "row", gap: 2 },
  reviewPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginTop: 13,
    backgroundColor: C.blush,
  },
  reviewComment: { fontSize: 14, lineHeight: 21, color: C.ink, marginTop: 12 },
  replyPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: C.blush,
  },
  reviewComposer: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    marginTop: 14,
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(53, 92, 69, 0.04)" }],
    elevation: 1,
  },
  reviewPicker: { flexDirection: "row", gap: 7, marginVertical: 13 },
  reviewPhotoPicker: {
    minHeight: 78,
    borderRadius: 17,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E2E9E2",
    backgroundColor: "#FFFFFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  reviewPhotoPickerIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPhotoPreview: {
    height: 220,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: C.blush,
  },
  reviewPreviewImage: { width: "100%", height: "100%", },
  reviewPhotoRemove: {
    position: "absolute",
    right: 10,
    top: 10,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "rgba(41,35,38,.82)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewPhotoRemoveText: { fontSize: 12, fontWeight: "800", color: C.white },
  reviewInput: {
    minHeight: 92,
    borderRadius: 16,
    backgroundColor: C.pale,
    borderWidth: 1,
    borderColor: C.line,
    padding: 13,
    fontSize: 14,
    color: C.ink,
    textAlignVertical: "top",
    outlineStyle: "none" as never,
  },
  reviewCharacterCount: {
    fontSize: 10,
    color: C.muted,
    textAlign: "right",
    marginTop: 5,
  },
  progress: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F4F7F2",
    overflow: "hidden",
    marginBottom: 12,
  },
  bookingContent: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  bookingHero: {
    height: 158,
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#315E45",
    justifyContent: "flex-end",
    position: "relative",
    boxShadow: [{ offsetX: 0, offsetY: 7, blurRadius: 18, color: "rgba(22, 78, 53, 0.13)" }],
    elevation: 2,
  },
  bookingHeroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  bookingHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17, 45, 31, 0.48)" },
  bookingHeroCopy: { paddingHorizontal: 22, paddingBottom: 19, gap: 4 },
  bookingHeroEyebrow: { color: "#E4F0E6", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  bookingHeroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "900" },
  bookingHeroSubtitle: { color: "#F3F7F1", fontSize: 13, lineHeight: 18 },
  bookingSelectedNotice: { padding: 14, marginBottom: 14, borderRadius: 16, backgroundColor: "#EAF3EC", gap: 4 },
  bookingCalendarCard: {
    padding: 14,
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 15, color: "rgba(22, 78, 53, 0.07)" }],
    elevation: 2,
  },
  bookingMonthRow: { minHeight: 40, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookingMonthButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F1F6F0", alignItems: "center", justifyContent: "center" },
  bookingMonthTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bookingMonthText: { color: C.ink, fontSize: 17, fontWeight: "800" },
  bookingCalendar: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 5 },
  bookingWeekday: { width: "14.1%", height: 27, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#F2F6F0" },
  bookingDay: { width: "14.1%", height: 35, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "#E8EEE7", backgroundColor: "#FFFFFF" },
  bookingDayActive: { backgroundColor: C.rose, borderColor: C.rose },
  bookingDayText: { fontSize: 12, fontWeight: "700", color: C.ink },
  bookingStaffCard: { padding: 14, marginBottom: 14, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 15, color: "rgba(22, 78, 53, 0.06)" }], elevation: 1 },
  bookingStaffHeading: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  bookingStaffControls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  staffSelectDropdown: { flex: 1, minWidth: 225, minHeight: 56, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: "#FCFDFC", flexDirection: "row", alignItems: "center", gap: 9 },
  bookingStaffAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EAF3EC" },
  bookingStaffAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EAF3EC", alignItems: "center", justifyContent: "center" },
  bookingStaffInitial: { color: C.rose, fontSize: 15, fontWeight: "800" },
  bookingStaffName: { color: C.ink, fontSize: 12, fontWeight: "800" },
  bookingStaffTip: { flex: 1, minWidth: 225, minHeight: 56, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 15, backgroundColor: "#EAF3EC", flexDirection: "row", alignItems: "center", gap: 7 },
  bookingStaffTipText: { flex: 1, color: "#315E45", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  bookingStaffMenu: { marginTop: 8, padding: 6, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: "#FFFFFF", boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, color: "rgba(22, 78, 53, 0.08)" }], elevation: 2 },
  bookingStaffOption: { minHeight: 54, paddingHorizontal: 7, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 11 },
  bookingAvailabilityCard: { padding: 14, marginBottom: 16, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 15, color: "rgba(22, 78, 53, 0.06)" }], elevation: 1 },
  bookingSectionHeading: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  bookingSectionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#EAF3EC", alignItems: "center", justifyContent: "center" },
  bookingSectionTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  bookingSectionSubtitle: { color: C.muted, fontSize: 10, lineHeight: 15 },
  bookingHint: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  bookingTime: { width: "22.3%", minHeight: 36, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F4F7F2", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  progressFill: { width: "66%", height: "100%", backgroundColor: C.rose },
  bookingServiceList: {
    width: "100%",
    gap: 12,
    alignItems: "stretch",
  },
  bookingServiceChoice: {
    width: "100%",
    minWidth: 0,
    marginBottom: 0,
  },
  choiceCard: {
    minHeight: 86,
    padding: 15,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  choiceSelected: {
    borderWidth: 2,
    borderColor: C.rose,
    backgroundColor: "#FFFFFF",
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSpace: { height: 60 },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  disabledControl: { opacity: 0.25 },
  calendar: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  calendarWeekday: { fontSize: 11, fontWeight: "800", color: C.muted },
  day: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 99,
  },
  dayActive: { backgroundColor: C.rose },
  dayText: { fontSize: 13, fontWeight: "700", color: C.ink },
  dayTextActive: { color: C.white },
  dayTextDisabled: { color: "#E2E9E2" },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  time: {
    width: "31%",
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: C.white,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  timeActive: { backgroundColor: C.rose, borderColor: C.rose },
  timeDisabled: { backgroundColor: "#F4F7F2", borderColor: "#E2E9E2" },
  timeTextActive: { color: C.white },
  summaryCard: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 16, color: "rgba(53, 92, 69, 0.06)" }],
    elevation: 2,
  },
  summaryLogo: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 17 },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginVertical: 9,
  },
  price: { fontSize: 22, fontWeight: "900", color: C.rose },
  notice: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.blush,
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  ticket: {
    width: "100%",
    padding: 20,
    borderRadius: 26,
    backgroundColor: C.white,
    alignItems: "center",
    marginVertical: 15,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: 16, color: "rgba(53, 92, 69, 0.05)" }],
    elevation: 2,
  },
  notificationList: { gap: 10 },
  notificationCard: {
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  notificationCardUnread: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EDF5EE",
    borderWidth: 1.5,
  },
  notificationIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIconUnread: { backgroundColor: C.rose },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationTitleRead: { color: C.muted, fontWeight: "600" },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.rose,
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },
  notificationDate: { fontSize: 10, color: C.muted, flexShrink: 1 },
  notificationReadButton: {
    minHeight: 32,
    borderRadius: 11,
    backgroundColor: C.blush,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  notificationReadButtonText: {
    fontSize: 10,
    fontWeight: "900",
    color: C.roseDark,
  },
  bookingCard: {
    padding: 21,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 22,
    boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(53, 92, 69, 0.04)" }],
    elevation: 1,
  },
  bookingActions: { flexDirection: "row", justifyContent: "space-around" },
  bookingMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  bookingStatus: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    color: C.green,
    backgroundColor: "#EDF5EE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  ownerSalonStrip: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: C.blush,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  ownerCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  ownerActionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  ownerNote: {
    fontSize: 13,
    lineHeight: 19,
    color: C.roseDark,
    backgroundColor: C.pale,
    padding: 11,
    borderRadius: 12,
    marginTop: 10,
  },
  ownerState: {
    fontSize: 10,
    fontWeight: "800",
    color: C.green,
    backgroundColor: "#EDF5EE",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
  },
  ownerStateOff: { color: C.muted, backgroundColor: "#F4F7F2" },
  ownerProfileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  empty: {
    alignItems: "center",
    padding: 35,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E2E9E2",
    gap: 6,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 26,
    padding: 18,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  profileAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { fontSize: 30, fontWeight: "900", color: C.white },
  preferenceCard: {
    padding: 17,
    borderRadius: 20,
    backgroundColor: C.blush,
    marginBottom: 20,
  },
  preferenceRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  preferenceItem: { width: "45%" },
  menuRow: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  roleRow: { flexDirection: "row", gap: 12 },
  roleCard: {
    flex: 1,
    padding: 17,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    gap: 10,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, color: "rgba(53, 92, 69, 0.04)" }],
    elevation: 1,
  },
  stats: { flexDirection: "row", gap: 10, marginVertical: 20 },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 17,
    backgroundColor: C.white,
    alignItems: "center",
  },
  statValue: { fontSize: 21, fontWeight: "900", color: C.roseDark },
  ownerDashboardHero: {
    minHeight: 238,
    borderRadius: 30,
    backgroundColor: C.blush,
    padding: 25,
    overflow: "hidden",
    marginBottom: 25,
    borderWidth: 1,
    borderColor: C.line,
  },
  ownerHeroGlow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    right: -72,
    top: -90,
    backgroundColor: "rgba(255,255,255,.07)",
  },
  ownerHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  ownerLogoutButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.24)",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ownerLogoutText: { fontSize: 12, fontWeight: "900", color: C.ink },
  ownerHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,.12)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ownerHeroLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#6F946E",
  },
  ownerHeroBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: C.roseDark,
  },
  ownerHeroStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  ownerHeroStatusText: { fontSize: 10, fontWeight: "800", color: C.roseDark },
  ownerHeroIdentity: { flexDirection: "row", alignItems: "center", gap: 17 },
  ownerDashboardPhoto: {
    width: 86,
    height: 86,
    borderRadius: 25,
    backgroundColor: C.blush,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.45)",
  },
  ownerDashboardPhotoFallback: {
    width: 86,
    height: 86,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.14)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.28)",
  },
  ownerHeroCopy: { flex: 1, minWidth: 0 },
  ownerHeroGreeting: {
    fontSize: 13,
    fontWeight: "600",
    color: C.roseDark,
    marginBottom: 4,
  },
  ownerHeroTitle: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -0.6,
  },
  ownerHeroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    maxWidth: 500,
  },
  ownerHeroMetaText: { flexShrink: 1, fontSize: 12, color: C.roseDark },
  ownerDashboardState: {
    minHeight: 145,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 18,
    marginBottom: 18,
  },
  ownerSectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 5,
    marginBottom: 13,
  },
  ownerSectionEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: C.rose,
    marginBottom: 4,
  },
  ownerSectionTitle: { fontSize: 19, fontWeight: "900", color: C.ink },
  ownerUpdatedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#EDF5EE",
  },
  ownerUpdatedText: { fontSize: 9, fontWeight: "900", color: C.green },
  ownerMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
    marginBottom: 27,
  },
  ownerMetricCard: {
    flexGrow: 1,
    minWidth: 135,
    minHeight: 144,
    borderRadius: 23,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 15,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, color: "rgba(53, 92, 69, 0.04)" }],
    elevation: 1,
  },
  ownerMetricIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  ownerMetricRose: { backgroundColor: "#EDF5EE" },
  ownerMetricGold: { backgroundColor: "#EDF5EE" },
  ownerMetricPurple: { backgroundColor: "#EDF5EE" },
  ownerMetricGreen: { backgroundColor: "#EDF5EE" },
  ownerMetricValue: {
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "900",
    color: C.ink,
  },
  ownerMetricLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.roseDark,
    marginTop: 2,
  },
  ownerMetricCaption: { fontSize: 10, color: C.muted, marginTop: 3 },
  ownerManagementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
    marginBottom: 24,
  },
  ownerManagementCard: {
    flexGrow: 1,
    minWidth: 240,
    minHeight: 96,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  ownerManagementIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerManagementCopy: { flex: 1, minWidth: 0 },
  ownerManagementTitle: { fontSize: 13, fontWeight: "800", color: C.ink },
  ownerManagementDescription: {
    fontSize: 10.5,
    lineHeight: 15,
    color: C.muted,
    marginTop: 3,
  },
  ownerHealthPanel: {
    minHeight: 90,
    borderRadius: 21,
    backgroundColor: "#EDF5EE",
    borderWidth: 1,
    borderColor: "#E2E9E2",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ownerHealthIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerHealthTitle: { fontSize: 13, fontWeight: "900", color: "#4A765A" },
  ownerHealthText: {
    fontSize: 10.5,
    lineHeight: 15,
    color: "#4A765A",
    marginTop: 3,
  },
  ownerPageActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 17,
  },
  ownerAddButton: {
    minHeight: 43,
    borderRadius: 14,
    backgroundColor: C.rose,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ownerAddButtonText: { fontSize: 12, fontWeight: "900", color: C.white },
  ownerEditableCard: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? 330 : "100%",
    minHeight: 154,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 10, color: "rgba(53, 92, 69, 0.035)" }],
    elevation: 1,
  },
  ownerInlineActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  ownerEditAction: {
    minHeight: 35,
    borderRadius: 11,
    backgroundColor: C.blush,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ownerEditActionText: { fontSize: 11, fontWeight: "800", color: C.roseDark },
  ownerRemoveAction: {
    minWidth: 82,
    minHeight: 35,
    borderRadius: 11,
    backgroundColor: "#EDF5EE",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  ownerRemoveActionText: { fontSize: 11, fontWeight: "800", color: "#355C45" },
  ownerPortfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  ownerPortfolioCard: {
    width: Platform.OS === "web" ? 210 : "47%",
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: C.blush,
  },
  ownerPortfolioImage: { width: "100%", height: "100%", },
  ownerPortfolioRemove: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(41,35,38,.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  salonOwnerReply: {
    marginTop: 14,
    padding: 13,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 3,
    borderLeftColor: C.rose,
  },
  salonOwnerReplyHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 7,
  },
  salonOwnerReplyLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: C.roseDark,
  },
  salonOwnerReplyText: { fontSize: 13, lineHeight: 19, color: C.ink },
  salonOwnerReplyDate: { fontSize: 9, color: C.muted, marginTop: 7 },
  ownerReplyButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: C.blush,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  ownerReplyButtonText: { fontSize: 11, fontWeight: "900", color: C.roseDark },
  ownerReplyNotice: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.blush,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 17,
  },
  ownerEditorSafe: { flex: 1, backgroundColor: C.pale },
  staffModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(28,20,23,.62)",
    justifyContent: "flex-end",
  },
  staffModalSheet: {
    width: "100%",
    maxWidth: 680,
    maxHeight: "82%",
    alignSelf: "center",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: C.pale,
    padding: 20,
    paddingBottom: 30,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 22, color: "rgba(0, 0, 0, 0.25)" }],
    elevation: 18,
  },
  staffModalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E9E2",
    alignSelf: "center",
    marginBottom: 18,
  },
  staffModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  staffModalList: { gap: 11, paddingBottom: 8 },
  staffModalCard: {
    minHeight: 104,
    borderRadius: 21,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  staffModalCardSelected: {
    borderWidth: 2,
    borderColor: C.rose,
    backgroundColor: "#FFFFFF",
  },
  staffModalAvatar: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: C.blush,
  },
  staffModalAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.roseDark,
  },
  staffModalState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  staffModalEmptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.blush,
  },
  ownerEditorHeader: {
    minHeight: 82,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ownerEditorKicker: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: C.rose,
    marginBottom: 4,
  },
  ownerEditorTitle: { fontSize: 20, fontWeight: "900", color: C.ink },
  ownerEditorScroll: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 35,
  },
  ownerEditorFieldWrap: { marginBottom: 15 },
  ownerEditorLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.ink,
    marginBottom: 7,
  },
  ownerEditorInput: {
    minHeight: 53,
    borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.ink,
    outlineStyle: "none" as never,
  },
  ownerEditorTextarea: { minHeight: 110, textAlignVertical: "top" },
  ownerEditorRow: { flexDirection: "row", gap: 11 },
  ownerEditorHalf: { flex: 1, minWidth: 0 },
  ownerToggleRow: {
    minHeight: 72,
    borderRadius: 17,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 15,
  },
  ownerSalonPhotoPicker: {
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E2E9E2",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 18,
  },
  ownerSalonPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerSalonPhotoPreview: {
    height: 250,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.blush,
    marginBottom: 18,
  },
  ownerSalonPhoto: { width: "100%", height: "100%", },
  ownerSalonPhotoActions: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  ownerPhotoAction: {
    minHeight: 39,
    borderRadius: 12,
    backgroundColor: "rgba(41,35,38,.84)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ownerPhotoRemoveAction: { backgroundColor: "rgba(139,35,57,.92)" },
  ownerEditorPhotoPicker: {
    minHeight: 84,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E2E9E2",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  ownerEditorPhotoPreview: {
    height: 220,
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: C.blush,
    marginBottom: 16,
  },
  ownerEditorPhoto: { width: "100%", height: "100%", },
  ownerEditorPhotoRemove: {
    position: "absolute",
    right: 10,
    top: 10,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "rgba(41,35,38,.82)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ownerEditorCount: {
    fontSize: 10,
    color: C.muted,
    textAlign: "right",
    marginTop: -9,
    marginBottom: 15,
  },
  ownerEditorFooter: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  ownerEditorButton: {
    minHeight: 48,
    borderRadius: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ownerEditorCancel: {
    backgroundColor: C.pale,
    borderWidth: 1,
    borderColor: C.line,
  },
  ownerEditorSave: { backgroundColor: C.rose, minWidth: 150 },
  ownerEditorCancelText: { fontSize: 13, fontWeight: "800", color: C.muted },
  ownerEditorSaveText: { fontSize: 13, fontWeight: "900", color: C.white },
  promptBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    backgroundColor: "rgba(24,35,18,.48)",
  },
  promptSheet: {
    width: "100%",
    maxWidth: 410,
    padding: 25,
    borderRadius: 28,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    boxShadow: [{ offsetX: 0, offsetY: 12, blurRadius: 26, color: "rgba(53, 92, 69, 0.18)" }],
    elevation: 15,
  },
  promptIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.blush,
    marginBottom: 17,
  },
  promptEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: C.rose,
    marginBottom: 6,
  },
  promptTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.45,
    color: C.ink,
  },
  promptTitleCentered: { textAlign: "center" },
  promptMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    marginTop: 8,
    marginBottom: 23,
  },
  promptActions: { flexDirection: "row", gap: 10 },
  promptCancel: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.pale,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  promptCancelText: { color: C.roseDark, fontSize: 12, fontWeight: "800" },
  promptConfirm: {
    flex: 1.15,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: C.rose,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  promptConfirmText: { color: C.white, fontSize: 12, fontWeight: "900" },
  profileAvatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.blush,
  },
  favoriteToast: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 100,
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: C.roseDark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 14, color: "rgba(0, 0, 0, 0.22)" }],
    elevation: 12,
  },
  favoriteToastError: { backgroundColor: "#355C45" },
  favoriteToastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteToastText: {
    flex: 1,
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  reviewCardEditing: {
    borderWidth: 2,
    borderColor: C.rose,
    backgroundColor: "#FFFFFF",
  },
  reviewActions: { alignItems: "flex-end", gap: 7 },
  reviewEditButton: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: C.blush,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewEditText: { fontSize: 11, fontWeight: "800", color: C.roseDark },
  reviewComposerHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewCancelButton: {
    minHeight: 36,
    borderRadius: 11,
    backgroundColor: C.blush,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCancelText: { fontSize: 11, fontWeight: "800", color: C.roseDark },
});
