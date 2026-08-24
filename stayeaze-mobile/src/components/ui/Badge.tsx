import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'indigo';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const getStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'warning':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'danger':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      case 'info':
        return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
      case 'indigo':
        return { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  };

  const style = getStyles();

  return (
    <View style={[styles.container, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.text, { color: style.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
