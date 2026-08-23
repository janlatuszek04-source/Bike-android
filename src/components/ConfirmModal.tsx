import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, danger && styles.dangerBtn]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.bgCard,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  message: {
    color: theme.textMuted,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 18,
  },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.bgElevated,
    alignItems: 'center',
  },
  cancelText: { color: theme.text, fontFamily: 'Inter-Bold', fontSize: 15 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  dangerBtn: { backgroundColor: theme.danger },
  confirmText: {
    color: theme.bg,
    fontFamily: 'Inter-Bold',
    fontSize: 15,
  },
});
