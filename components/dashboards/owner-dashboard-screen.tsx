import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { getApiAssetUrl, type AuthUser, type OwnerDashboard } from '@/services/api';

const faceFitLogo = require('../../assets/images/facefit-logo-green.png');

type OwnerDestination = 'owner-bookings' | 'owner-services' | 'owner-staff' | 'owner-profile' | 'owner-reviews';

type Props = {
  dashboard: OwnerDashboard | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  unreadNotifications: number;
  desktop: boolean;
  onNotifications: () => void;
  onNavigate: (destination: OwnerDestination) => void;
  onReload: () => void;
  onLogout: () => void;
};

type AnalyticsPoint = { label: string; revenue: number; bookings: number };
type AnalyticsMetric = 'revenue' | 'bookings';
type HairstyleSeries = { name: string; color: string; values: number[] };
type StaffPerformanceItem = { name: string; bookings: number; revenue: number; rating: number };

const colors = { rose: '#397A24', roseDark: '#25430D', blush: '#E6F8C5', ink: '#24251F', muted: '#25430D', line: '#DCEBC8', white: '#FFFFFF', green: '#397A24', gold: '#8BCF35' };
const HAIRSTYLE_LINE_COLORS = [colors.rose, colors.green, colors.gold, '#397A24'];

// SVG text doesn't inherit the app font on web, so set one explicitly.
// On native, undefined falls back to the system font.
const CHART_FONT = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

const navigation: { label: string; icon: keyof typeof Ionicons.glyphMap; destination: OwnerDestination }[] = [
  { label: 'Manage booking requests', icon: 'calendar', destination: 'owner-bookings' },
  { label: 'Services & pricing', icon: 'pricetag', destination: 'owner-services' },
  { label: 'Staff & specializations', icon: 'people', destination: 'owner-staff' },
  { label: 'Business profile & portfolio', icon: 'business', destination: 'owner-profile' },
  { label: 'Reviews & ratings', icon: 'star', destination: 'owner-reviews' },
];

const WINDOW_DAYS = 7;
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// MOCK DATA — these two lists stand in for real backend lookups. Replace with the salon's
// actual service catalog (for hairstyle trend) and staff roster (for performance), e.g.
// GET /owner/analytics/hairstyles?from=...&to=... and GET /owner/analytics/staff?from=...&to=...
const MOCK_HAIRSTYLE_CATALOG = ['Layered Cut', 'Classic Bob', 'Undercut Fade', 'Balayage', 'Korean Perm', 'Textured Crop'];
const MOCK_STAFF_ROSTER = ['Mika Santos', 'Dana Reyes', 'Jules Cruz', 'Ana Bautista', 'Ken Villanueva'];

function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString()}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShort(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

function initials(name: string) {
  return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// Deterministic pseudo-random generator so the same date window always renders the same
// mock numbers (feels like a real filter) without needing a random-number backend call.
function seededRandom(seed: string) {
  let hash = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  let state = (hash ^ (hash >>> 16)) >>> 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// MOCK DATA GENERATION — swap these for GET /owner/analytics?from=&to= once available.
// The shapes (points/series) are kept so the charts below need no changes when the real
// endpoint is wired in; only the bodies of these functions get replaced with API calls.
function generateRevenueBookingPoints(windowStart: Date): AnalyticsPoint[] {
  const seedBase = isoDay(windowStart);
  const points: AnalyticsPoint[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const day = addDays(windowStart, i);
    const label = `${WEEKDAY_ABBR[day.getDay()]} ${day.getDate()}`;
    const revenue = Math.round(900 + seededRandom(`${seedBase}-${i}-rev`) * 2600);
    const bookings = Math.max(1, Math.round(revenue / 230));
    points.push({ label, revenue, bookings });
  }
  return points;
}

// MOCK DATA — each hairstyle gets a base level plus a gentle trend and small daily noise so the
// lines read like real trends instead of random scribbles. Replace with real per-style daily
// booking counts from the backend (same { labels, series } shape).
function generateHairstyleSeries(windowStart: Date): { labels: string[]; series: HairstyleSeries[] } {
  const seedBase = isoDay(windowStart);
  const labels = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const day = addDays(windowStart, i);
    return `${WEEKDAY_ABBR[day.getDay()]} ${day.getDate()}`;
  });
  const withTotals = MOCK_HAIRSTYLE_CATALOG.map(name => {
    const base = 5 + seededRandom(`${seedBase}-${name}-base`) * 7;
    const slope = (seededRandom(`${seedBase}-${name}-slope`) - 0.5) * 1.6;
    const values = Array.from({ length: WINDOW_DAYS }, (_, i) => {
      const day = addDays(windowStart, i);
      const noise = (seededRandom(`${isoDay(day)}-style-${name}`) - 0.5) * 4;
      return Math.max(1, Math.round(base + slope * i + noise));
    });
    return { name, values, total: values.reduce((sum, v) => sum + v, 0) };
  });
  const top = withTotals.sort((a, b) => b.total - a.total).slice(0, 4);
  const series = top.map((item, index) => ({ name: item.name, color: HAIRSTYLE_LINE_COLORS[index], values: item.values }));
  return { labels, series };
}

function generateStaffPerformance(windowStart: Date): StaffPerformanceItem[] {
  const seedBase = isoDay(windowStart);
  return MOCK_STAFF_ROSTER
    .map(name => {
      const bookings = Math.round(6 + seededRandom(`${seedBase}-staff-${name}-b`) * 34);
      const revenue = Math.round(bookings * (180 + seededRandom(`${seedBase}-staff-${name}-r`) * 160));
      const rating = Math.round((3.9 + seededRandom(`${seedBase}-staff-${name}-rt`) * 1.1) * 10) / 10;
      return { name, bookings, revenue, rating };
    })
    .sort((a, b) => b.bookings - a.bookings);
}

function RevenueBookingsChart({ metric, data }: { metric: AnalyticsMetric; data: AnalyticsPoint[] }) {
  const max = Math.max(...data.map(point => point[metric]), 1);
  return (
    <View style={styles.chartBars}>
      {data.map(point => {
        const value = point[metric];
        const heightPct = Math.max((value / max) * 100, 6);
        return (
          <View key={point.label} style={styles.chartBarColumn}>
            <Text style={styles.chartBarValue}>{metric === 'revenue' ? formatCurrency(value) : value}</Text>
            <View style={styles.chartBarTrack}>
              <View style={[styles.chartBar, { height: `${heightPct}%` }, metric === 'bookings' && styles.chartBarAlt]} />
            </View>
            <Text style={styles.chartBarLabel}>{point.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Turns points into a smooth curve (Catmull-Rom converted to cubic Béziers).
// Control points are clamped so the curve never dips below the baseline or above the top.
function buildSmoothPath(points: { x: number; y: number }[], minY: number, maxY: number) {
  if (points.length < 2) return '';
  const clampY = (y: number) => Math.min(Math.max(y, minY), maxY);
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function LineChart({ labels, series, height = 200 }: { labels: string[]; series: HairstyleSeries[]; height?: number }) {
  const [width, setWidth] = useState(0);

  const padding = { top: 12, right: 26, bottom: 26, left: 30 };
  const plotWidth = Math.max(width - padding.left - padding.right, 0);
  const plotHeight = height - padding.top - padding.bottom;

  const rawMax = Math.max(...series.flatMap(s => s.values), 1);
  const niceMax = Math.max(4, Math.ceil(rawMax / 4) * 4);
  const ticks = [0, 1, 2, 3, 4].map(step => Math.round((niceMax * step) / 4));

  const xAt = (index: number) => padding.left + (labels.length > 1 ? (plotWidth * index) / (labels.length - 1) : plotWidth / 2);
  const yAt = (value: number) => padding.top + plotHeight - (value / niceMax) * plotHeight;

  return (
    <View>
      <View style={{ height }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map(tick => {
              const y = yAt(tick);
              return (
                <G key={`tick-${tick}`}>
                  <Line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke={colors.line} strokeWidth={1} strokeDasharray={tick === 0 ? undefined : '4 4'} />
                  <SvgText x={padding.left - 8} y={y + 3} fontSize={10} fontWeight="700" fontFamily={CHART_FONT} fill={colors.muted} textAnchor="end">{tick}</SvgText>
                </G>
              );
            })}

            {labels.map((label, i) => (
              <SvgText key={`x-${label}`} x={xAt(i)} y={height - 8} fontSize={10} fontWeight="700" fontFamily={CHART_FONT} fill={colors.muted} textAnchor="middle">{label}</SvgText>
            ))}

            {series.map(item => {
              const pts = item.values.map((value, i) => ({ x: xAt(i), y: yAt(value) }));
              return (
                <Path
                  key={`line-${item.name}`}
                  d={buildSmoothPath(pts, padding.top, padding.top + plotHeight)}
                  stroke={item.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              );
            })}

            {series.map(item =>
              item.values.map((value, i) => (
                <Circle key={`dot-${item.name}-${i}`} cx={xAt(i)} cy={yAt(value)} r={3.5} fill={item.color} stroke={colors.white} strokeWidth={2} />
              ))
            )}
          </Svg>
        )}
      </View>
      <View style={styles.legendRow}>
        {series.map(item => (
          <View key={item.name} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StaffPerformanceCard({ items }: { items: StaffPerformanceItem[] }) {
  const medalColors = [colors.gold, '#397A24', '#25430D'];
  return (
    <View style={styles.analyticsCard}>
      <View style={styles.staffList}>
        {items.map((staffMember, index) => (
          <View key={staffMember.name} style={styles.staffRow}>
            <View style={[styles.staffRank, index < 3 && { backgroundColor: medalColors[index] }]}>
              <Text style={[styles.staffRankText, index < 3 && styles.staffRankTextTop]}>{index + 1}</Text>
            </View>
            <View style={styles.staffAvatar}><Text style={styles.staffAvatarText}>{initials(staffMember.name)}</Text></View>
            <View style={styles.grow}>
              <Text style={styles.staffName}>{staffMember.name}</Text>
              <Text style={styles.staffMeta}>{staffMember.bookings} bookings · {formatCurrency(staffMember.revenue)}</Text>
            </View>
            <View style={styles.staffRatingPill}>
              <Ionicons name="star" size={12} color={colors.gold} />
              <Text style={styles.staffRatingText}>{staffMember.rating.toFixed(1)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function DatePickerModal({ visible, selectedDate, maxDate, onSelect, onClose }: { visible: boolean; selectedDate: Date; maxDate: Date; onSelect: (date: Date) => void; onClose: () => void }) {
  const [viewDate, setViewDate] = useState(selectedDate);
  useEffect(() => { if (visible) setViewDate(selectedDate); }, [visible, selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const leadingBlanks = startWeekday(year, month);
  const cells: (Date | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1))];
  const canGoNextMonth = new Date(year, month + 1, 1) <= maxDate;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <Pressable accessibilityRole="button" onPress={() => setViewDate(addMonths(viewDate, -1))} style={styles.pickerNavButton}>
              <Ionicons name="chevron-back" size={18} color={colors.ink} />
            </Pressable>
            <Text style={styles.pickerMonthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <Pressable accessibilityRole="button" disabled={!canGoNextMonth} onPress={() => setViewDate(addMonths(viewDate, 1))} style={styles.pickerNavButton}>
              <Ionicons name="chevron-forward" size={18} color={canGoNextMonth ? colors.ink : colors.line} />
            </Pressable>
          </View>
          <View style={styles.pickerWeekRow}>
            {WEEKDAY_ABBR.map(day => <Text key={day} style={styles.pickerWeekLabel}>{day[0]}</Text>)}
          </View>
          <View style={styles.pickerGrid}>
            {cells.map((cellDate, index) => {
              if (!cellDate) return <View key={index} style={styles.pickerCell} />;
              const disabled = cellDate > maxDate;
              const isSelected = isSameDay(cellDate, selectedDate);
              return (
                <Pressable key={index} accessibilityRole="button" disabled={disabled} onPress={() => onSelect(cellDate)} style={[styles.pickerCell, isSelected && styles.pickerCellSelected]}>
                  <Text style={[styles.pickerCellText, disabled && styles.pickerCellTextDisabled, isSelected && styles.pickerCellTextSelected]}>{cellDate.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function OwnerDashboardScreen({ dashboard, user, loading, error, unreadNotifications, desktop, onNotifications, onNavigate, onReload, onLogout }: Props) {
  const [analyticsMetric, setAnalyticsMetric] = useState<AnalyticsMetric>('revenue');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const windowStart = useMemo(() => addDays(anchorDate, -(WINDOW_DAYS - 1)), [anchorDate]);
  const isNextDisabled = isSameDay(anchorDate, today) || anchorDate > today;
  const dateRangeLabel = `${formatShort(windowStart)} – ${formatShort(anchorDate)}, ${anchorDate.getFullYear()}`;

  const metrics = [
    { label: 'Today', value: String(dashboard?.todayBookings ?? 0), caption: 'appointments', icon: 'calendar-clear-outline' as const, tone: styles.metricRose },
    { label: 'Pending', value: String(dashboard?.pendingBookings ?? 0), caption: 'need attention', icon: 'time-outline' as const, tone: styles.metricGold },
    { label: 'Rating', value: (dashboard?.rating ?? 0).toFixed(1), caption: `${dashboard?.reviewCount ?? 0} reviews`, icon: 'star-outline' as const, tone: styles.metricPurple },
    { label: 'Team', value: String(dashboard?.availableStaff ?? 0), caption: 'available staff', icon: 'people-outline' as const, tone: styles.metricGreen },
  ];

  const { revenuePoints, previousTotal, activeTotal, average, trendPct, trendUp, hairstyleLabels, hairstyleSeries, staffPerformance } = useMemo(() => {
    const points = generateRevenueBookingPoints(windowStart);
    const previousPoints = generateRevenueBookingPoints(addDays(windowStart, -WINDOW_DAYS));
    const total = points.reduce((sum, point) => sum + point[analyticsMetric], 0);
    const previous = previousPoints.reduce((sum, point) => sum + point[analyticsMetric], 0);
    const pct = previous > 0 ? Math.round(((total - previous) / previous) * 100) : 0;
    const hairstyles = generateHairstyleSeries(windowStart);
    return {
      revenuePoints: points,
      activeTotal: total,
      previousTotal: previous,
      average: total / points.length,
      trendPct: pct,
      trendUp: pct >= 0,
      hairstyleLabels: hairstyles.labels,
      hairstyleSeries: hairstyles.series,
      staffPerformance: generateStaffPerformance(windowStart),
    };
  }, [windowStart, analyticsMetric]);

  function goToPreviousPeriod() {
    setAnchorDate(current => addDays(current, -WINDOW_DAYS));
  }

  function goToNextPeriod() {
    setAnchorDate(current => {
      const next = addDays(current, WINDOW_DAYS);
      return next > today ? today : next;
    });
  }

  function handlePickDate(date: Date) {
    setAnchorDate(date > today ? today : date);
    setPickerOpen(false);
  }

  return <>
    <View style={styles.header}>
      <View style={styles.logo}><Image accessibilityLabel="FaceFit logo" source={faceFitLogo} style={styles.logoImage} /></View>
      <Text style={styles.headerTitle}>Salon dashboard</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${unreadNotifications} unread notifications`} onPress={onNotifications} style={styles.headerAction}>
        <Ionicons name="notifications-outline" size={21} color={colors.ink} />
        {unreadNotifications > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text></View>}
      </Pressable>
    </View>

    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Log out of FaceFit" onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
          <Ionicons name="log-out-outline" size={17} color={colors.white} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <View style={styles.status}><Ionicons name="checkmark-circle" size={16} color="#8BCF35" /><Text style={styles.statusText}>Salon active</Text></View>
      </View>
      <View style={styles.identity}>
        {dashboard?.profileImageUrl
          ? <Image accessibilityLabel={`${dashboard.name} profile picture`} source={{ uri: getApiAssetUrl(dashboard.profileImageUrl)! }} style={styles.photo} />
          : <View style={styles.photoFallback}><Ionicons name="storefront-outline" size={34} color={colors.white} /></View>}
        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.heroTitle}>{dashboard?.name || user?.fullName || 'Your salon'}</Text>
          <View style={styles.meta}><Ionicons name="location-outline" size={15} color="#E6F8C5" /><Text numberOfLines={1} style={styles.metaText}>{dashboard?.address || 'Manage your salon from one place'}</Text></View>
        </View>
      </View>
    </View>

    {loading && !dashboard ? <View style={styles.state}><ActivityIndicator color={colors.rose} /><Text style={styles.small}>Loading live salon data...</Text></View>
      : error ? <Pressable onPress={onReload} style={styles.state}><Ionicons name="cloud-offline-outline" size={30} color={colors.rose} /><Text style={styles.cardTitle}>Could not refresh your dashboard</Text><Text style={styles.small}>{error} · Tap to retry</Text></Pressable>
      : <>
        <SectionHeading eyebrow="PERFORMANCE" title="Today at a glance" />
        <View style={styles.metricsGrid}>{metrics.map(metric => <View key={metric.label} style={[styles.metricCard, { flexBasis: desktop ? '22%' : '46%' }]}><View style={[styles.metricIcon, metric.tone]}><Ionicons name={metric.icon} size={21} color={colors.roseDark} /></View><Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricCaption}>{metric.caption}</Text></View>)}</View>

        <SectionHeading eyebrow="ANALYTICS" title="Salon analytics" />

        <View style={styles.filterBar}>
          <Pressable accessibilityRole="button" onPress={goToPreviousPeriod} style={styles.dateNavButton}>
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.dateLabelButton}>
            <Ionicons name="calendar-outline" size={14} color={colors.roseDark} />
            <Text style={styles.dateNavLabel}>{dateRangeLabel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isNextDisabled} onPress={goToNextPeriod} style={styles.dateNavButton}>
            <Ionicons name="chevron-forward" size={18} color={isNextDisabled ? colors.line : colors.ink} />
          </Pressable>
        </View>

        <Text style={styles.cardCaption}>Revenue & bookings trend</Text>
        <View style={styles.analyticsCard}>
          <View style={styles.analyticsTopRow}>
            <View style={styles.toggleGroup}>
              <Pressable accessibilityRole="button" onPress={() => setAnalyticsMetric('revenue')} style={[styles.toggleButton, analyticsMetric === 'revenue' && styles.toggleButtonActive]}>
                <Text style={[styles.toggleText, analyticsMetric === 'revenue' && styles.toggleTextActive]}>Revenue</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setAnalyticsMetric('bookings')} style={[styles.toggleButton, analyticsMetric === 'bookings' && styles.toggleButtonActive]}>
                <Text style={[styles.toggleText, analyticsMetric === 'bookings' && styles.toggleTextActive]}>Bookings</Text>
              </Pressable>
            </View>
            <View style={[styles.trendPill, trendUp ? styles.trendPillUp : styles.trendPillDown]}>
              <Ionicons name={trendUp ? 'trending-up' : 'trending-down'} size={13} color={trendUp ? colors.green : '#397A24'} />
              <Text style={[styles.trendText, { color: trendUp ? colors.green : '#397A24' }]}>{trendUp ? '+' : ''}{trendPct}% vs previous week</Text>
            </View>
          </View>

          <RevenueBookingsChart metric={analyticsMetric} data={revenuePoints} />

          <View style={styles.chartFooter}>
            <View style={styles.chartFooterStat}>
              <Text style={styles.chartFooterValue}>{analyticsMetric === 'revenue' ? formatCurrency(activeTotal) : activeTotal}</Text>
              <Text style={styles.chartFooterLabel}>This week</Text>
            </View>
            <View style={styles.chartFooterStat}>
              <Text style={styles.chartFooterValue}>{analyticsMetric === 'revenue' ? formatCurrency(Math.round(average)) : average.toFixed(1)}</Text>
              <Text style={styles.chartFooterLabel}>Daily average</Text>
            </View>
            <View style={styles.chartFooterStat}>
              <Text style={styles.chartFooterValue}>{analyticsMetric === 'revenue' ? formatCurrency(previousTotal) : previousTotal}</Text>
              <Text style={styles.chartFooterLabel}>Previous week</Text>
            </View>
          </View>
        </View>

        <Text style={styles.cardCaption}>Top hairstyle trends</Text>
        <View style={styles.analyticsCard}>
          <LineChart labels={hairstyleLabels} series={hairstyleSeries} />
        </View>

        <Text style={styles.cardCaption}>Top staff performance</Text>
        <StaffPerformanceCard items={staffPerformance} />

        <SectionHeading eyebrow="QUICK ACCESS" title="Manage your salon" />
        <View style={styles.managementGrid}>{navigation.map((item, index) => <Pressable accessibilityRole="button" key={item.label} onPress={() => onNavigate(item.destination)} style={({ pressed }) => [styles.managementCard, { flexBasis: desktop ? '30%' : '100%' }, pressed && styles.pressed]}><View style={[styles.managementIcon, index % 3 === 1 && styles.metricGold, index % 3 === 2 && styles.metricGreen]}><Ionicons name={item.icon} size={22} color={colors.roseDark} /></View><View style={styles.grow}><Text style={styles.managementTitle}>{item.label}</Text><Text style={styles.managementDescription}>{index === 0 ? `${dashboard?.pendingBookings ?? 0} requests waiting` : index === 1 ? `${dashboard?.serviceCount ?? 0} published services` : index === 2 ? `${dashboard?.availableStaff ?? 0} team members available` : index === 3 ? 'Update salon information' : `${dashboard?.reviewCount ?? 0} customer reviews`}</Text></View><Ionicons name="arrow-forward" size={18} color={colors.rose} /></Pressable>)}</View>
        <View style={styles.health}><View style={styles.healthIcon}><Ionicons name="shield-checkmark" size={24} color={colors.white} /></View><View style={styles.grow}><Text style={styles.healthTitle}>Your salon is ready for bookings</Text><Text style={styles.healthText}>{dashboard?.serviceCount ?? 0} services are visible to FaceFit customers.</Text></View><Ionicons name="sparkles-outline" size={24} color="#8BCF35" /></View>
      </>}

    <DatePickerModal visible={pickerOpen} selectedDate={anchorDate} maxDate={today} onSelect={handlePickDate} onClose={() => setPickerOpen(false)} />
  </>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View></View>;
}

const styles = StyleSheet.create({
  header:{minHeight:82,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18},logo:{width:56,height:56,borderRadius:18,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',overflow:'hidden'},logoImage:{width:'100%',height:'100%',resizeMode:'contain'},headerTitle:{fontSize:21,fontWeight:'900',letterSpacing:-.3,color:colors.ink},headerAction:{width:48,height:48,borderRadius:17,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:-3,top:-5,minWidth:21,height:21,borderRadius:11,backgroundColor:'#397A24',alignItems:'center',justifyContent:'center',paddingHorizontal:4},badgeText:{fontSize:10,fontWeight:'900',color:colors.white},
  hero:{minHeight:220,borderRadius:28,backgroundColor:colors.roseDark,padding:23,overflow:'hidden',marginBottom:25},heroGlow:{position:'absolute',width:230,height:230,borderRadius:115,right:-72,top:-90,backgroundColor:'rgba(255,255,255,.07)'},heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:22},logout:{minHeight:38,borderRadius:12,backgroundColor:'rgba(255,255,255,.16)',borderWidth:1,borderColor:'rgba(255,255,255,.24)',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},logoutText:{fontSize:12,fontWeight:'900',color:colors.white},status:{flexDirection:'row',alignItems:'center',gap:5},statusText:{fontSize:10,fontWeight:'800',color:'#8BCF35'},identity:{flexDirection:'row',alignItems:'center',gap:17},photo:{width:86,height:86,borderRadius:25,resizeMode:'cover',backgroundColor:colors.blush,borderWidth:2,borderColor:'rgba(255,255,255,.45)'},photoFallback:{width:86,height:86,borderRadius:25,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.14)',borderWidth:2,borderColor:'rgba(255,255,255,.28)'},heroCopy:{flex:1,minWidth:0},greeting:{fontSize:13,fontWeight:'600',color:'#E6F8C5',marginBottom:4},heroTitle:{fontSize:29,lineHeight:35,fontWeight:'900',color:colors.white,letterSpacing:-.6},meta:{flexDirection:'row',alignItems:'center',gap:6,marginTop:12,maxWidth:500},metaText:{flexShrink:1,fontSize:12,color:'#E6F8C5'},
  state:{minHeight:145,borderRadius:20,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center',gap:8,padding:18,marginBottom:18},small:{fontSize:11,lineHeight:17,color:colors.muted},cardTitle:{fontSize:15,fontWeight:'700',color:colors.ink},sectionHeading:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:5,marginBottom:13},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:colors.rose,marginBottom:4},sectionTitle:{fontSize:19,fontWeight:'900',color:colors.ink},metricsGrid:{flexDirection:'row',flexWrap:'wrap',gap:11,marginBottom:27},metricCard:{flexGrow:1,minWidth:135,minHeight:158,borderRadius:21,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,padding:15},metricIcon:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',marginBottom:15},metricRose:{backgroundColor:'#E6F8C5'},metricGold:{backgroundColor:'#E6F8C5'},metricPurple:{backgroundColor:'#E6F8C5'},metricGreen:{backgroundColor:'#E6F8C5'},metricValue:{fontSize:25,lineHeight:29,fontWeight:'900',color:colors.ink},metricLabel:{fontSize:12,fontWeight:'800',color:colors.roseDark,marginTop:2},metricCaption:{fontSize:10,color:colors.muted,marginTop:3},managementGrid:{flexDirection:'row',flexWrap:'wrap',gap:11,marginBottom:24},managementCard:{flexGrow:1,minWidth:240,minHeight:88,borderRadius:20,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,padding:13,flexDirection:'row',alignItems:'center',gap:12},managementIcon:{width:45,height:45,borderRadius:15,backgroundColor:colors.blush,alignItems:'center',justifyContent:'center'},grow:{flex:1,minWidth:0},managementTitle:{fontSize:13,fontWeight:'800',color:colors.ink},managementDescription:{fontSize:10.5,lineHeight:15,color:colors.muted,marginTop:3},health:{minHeight:90,borderRadius:21,backgroundColor:'#E6F8C5',borderWidth:1,borderColor:'#DCEBC8',padding:15,flexDirection:'row',alignItems:'center',gap:12},healthIcon:{width:46,height:46,borderRadius:15,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},healthTitle:{fontSize:13,fontWeight:'900',color:'#397A24'},healthText:{fontSize:10.5,lineHeight:15,color:'#397A24',marginTop:3},pressed:{opacity:.72},
  filterBar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:16},dateNavButton:{width:34,height:34,borderRadius:11,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'},dateLabelButton:{flexDirection:'row',alignItems:'center',gap:7,minHeight:34,borderRadius:11,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,paddingHorizontal:13},dateNavLabel:{fontSize:12,fontWeight:'800',color:colors.ink},
  cardCaption:{fontSize:12.5,fontWeight:'800',color:colors.ink,marginBottom:9,marginTop:2},
  analyticsCard:{minHeight:120,borderRadius:21,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,padding:18,marginBottom:22},analyticsTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10},toggleGroup:{flexDirection:'row',backgroundColor:colors.blush,borderRadius:12,padding:3,gap:2},toggleButton:{minHeight:32,borderRadius:9,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},toggleButtonActive:{backgroundColor:colors.roseDark},toggleText:{fontSize:11.5,fontWeight:'800',color:colors.roseDark},toggleTextActive:{color:colors.white},trendPill:{flexDirection:'row',alignItems:'center',gap:5,minHeight:28,borderRadius:9,paddingHorizontal:10},trendPillUp:{backgroundColor:'#E6F8C5'},trendPillDown:{backgroundColor:'#E6F8C5'},trendText:{fontSize:11,fontWeight:'800'},
  chartBars:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',height:150,marginBottom:16},chartBarColumn:{flex:1,alignItems:'center',gap:6},chartBarValue:{fontSize:9,fontWeight:'800',color:colors.muted},chartBarTrack:{width:'62%',height:96,justifyContent:'flex-end'},chartBar:{width:'100%',borderRadius:8,backgroundColor:colors.rose,minHeight:6},chartBarAlt:{backgroundColor:colors.green},chartBarLabel:{flex:1,textAlign:'center',fontSize:10,fontWeight:'700',color:colors.muted},
  chartFooter:{flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderTopColor:colors.line,paddingTop:14},chartFooterStat:{alignItems:'flex-start'},chartFooterValue:{fontSize:15,fontWeight:'900',color:colors.ink},chartFooterLabel:{fontSize:10,color:colors.muted,marginTop:2},
  legendRow:{flexDirection:'row',flexWrap:'wrap',gap:14,marginTop:12,paddingTop:14,borderTopWidth:1,borderTopColor:colors.line},legendItem:{flexDirection:'row',alignItems:'center',gap:6},legendSwatch:{width:9,height:9,borderRadius:4.5},legendText:{fontSize:11,fontWeight:'700',color:colors.ink},
  staffList:{gap:13},staffRow:{flexDirection:'row',alignItems:'center',gap:11},staffRank:{width:24,height:24,borderRadius:12,backgroundColor:colors.blush,alignItems:'center',justifyContent:'center'},staffRankText:{fontSize:11,fontWeight:'900',color:colors.roseDark},staffRankTextTop:{color:colors.white},staffAvatar:{width:42,height:42,borderRadius:14,backgroundColor:colors.roseDark,alignItems:'center',justifyContent:'center'},staffAvatarText:{fontSize:13,fontWeight:'900',color:colors.white},staffName:{fontSize:13,fontWeight:'800',color:colors.ink},staffMeta:{fontSize:10.5,color:colors.muted,marginTop:2},staffRatingPill:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#E6F8C5',borderRadius:9,paddingHorizontal:9,minHeight:26},staffRatingText:{fontSize:11,fontWeight:'800',color:colors.ink},
  pickerBackdrop:{flex:1,backgroundColor:'rgba(28,20,23,.55)',alignItems:'center',justifyContent:'center',padding:24},pickerSheet:{width:'100%',maxWidth:340,borderRadius:22,backgroundColor:colors.white,padding:18},pickerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},pickerNavButton:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.blush},pickerMonthLabel:{fontSize:14,fontWeight:'900',color:colors.ink},pickerWeekRow:{flexDirection:'row',marginBottom:6},pickerWeekLabel:{flex:1,textAlign:'center',fontSize:10,fontWeight:'800',color:colors.muted},pickerGrid:{flexDirection:'row',flexWrap:'wrap'},pickerCell:{width:`${100/7}%`,aspectRatio:1,alignItems:'center',justifyContent:'center',borderRadius:10},pickerCellSelected:{backgroundColor:colors.roseDark},pickerCellText:{fontSize:12.5,fontWeight:'700',color:colors.ink},pickerCellTextDisabled:{color:colors.line},pickerCellTextSelected:{color:colors.white,fontWeight:'900'},
});
