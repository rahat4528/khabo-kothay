import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { darkTheme } from '../config/theme.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Mobile App Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const theme = this.props.theme || darkTheme;
      return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Something went wrong</Text>
          <Text style={[styles.message, { color: theme.colors.textMuted }]}>
            {this.state.error?.message || 'An unexpected error occurred in Khabo Kothay?.'}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel="Restart Application"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Restart Application</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  icon: {
    fontSize: 54,
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 16
  }
});

export default ErrorBoundary;
