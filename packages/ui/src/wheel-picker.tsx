import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uiColors } from './colors';

export interface WheelPickerOption {
  label: string;
  value: string;
}

interface WheelPickerProps {
  label: string;
  options: WheelPickerOption[];
  value: string;
  onChange: (value: string) => void;
  visibleRows?: number;
  itemHeight?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function WheelPicker({
  label,
  options,
  value,
  onChange,
  visibleRows = 5,
  itemHeight = 52,
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const safeSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const [visualIndex, setVisualIndex] = useState<number>(safeSelectedIndex);
  const pickerHeight = itemHeight * visibleRows;
  const sidePadding = (pickerHeight - itemHeight) / 2;

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      scrollRef.current?.scrollTo({ y: index * itemHeight, animated });
    },
    [itemHeight],
  );

  const settleAtOffset = useCallback(
    (offsetY: number, animated: boolean) => {
      if (!options.length) {
        return;
      }

      const rawIndex = offsetY / itemHeight;
      const nextIndex = clamp(Math.round(rawIndex), 0, options.length - 1);
      const nextOption = options[nextIndex];
      if (!nextOption) {
        return;
      }

      setVisualIndex(nextIndex);

      if (nextOption.value !== value) {
        onChange(nextOption.value);
      }

      if (Math.abs(rawIndex - nextIndex) > 0.01) {
        scrollToIndex(nextIndex, animated);
      }
    },
    [itemHeight, onChange, options, scrollToIndex, value],
  );

  useEffect(() => {
    if (!options.length) {
      return;
    }

    if (selectedIndex === -1) {
      const firstOption = options[0];
      if (firstOption) {
        onChange(firstOption.value);
      }
      return;
    }

    scrollToIndex(safeSelectedIndex, false);
  }, [onChange, options, safeSelectedIndex, scrollToIndex, selectedIndex]);

  useEffect(() => {
    setVisualIndex(safeSelectedIndex);
  }, [safeSelectedIndex]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    },
    [],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      settleAtOffset(event.nativeEvent.contentOffset.y, true);
    },
    [settleAtOffset],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      const offsetY = event.nativeEvent.contentOffset.y;
      setVisualIndex(offsetY / itemHeight);
      idleTimerRef.current = setTimeout(() => {
        settleAtOffset(offsetY, true);
      }, 110);
    },
    [itemHeight, settleAtOffset],
  );

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.picker, { height: pickerHeight }]}>
        <View
          pointerEvents="none"
          style={[
            styles.focusBand,
            {
              top: sidePadding,
              height: itemHeight,
            },
          ]}
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: sidePadding }}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
        >
          {options.map((option, index) => {
            const distance = Math.abs(index - visualIndex);
            const isActive = distance < 0.45;
            const isNear = distance < 1.25;
            const opacity = clamp(1 - distance / 2.4, 0.22, 1);

            return (
              <View key={option.value} style={[styles.item, { height: itemHeight }]}>
                <Text
                  style={[
                    styles.itemText,
                    isActive ? styles.itemTextActive : isNear ? styles.itemTextNear : styles.itemTextFar,
                    { opacity },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: uiColors.textDark,
    marginBottom: 10,
  },
  picker: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  focusBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(189,188,188,0.25)',
    zIndex: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '500',
  },
  itemTextActive: {
    color: uiColors.textPrimary,
    opacity: 1,
  },
  itemTextNear: {
    color: uiColors.textMuted,
    opacity: 0.65,
  },
  itemTextFar: {
    color: uiColors.textHint,
    opacity: 0.3,
  },
});
