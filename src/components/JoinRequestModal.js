import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COLORS = {
  primary: '#FF6B4A',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  overlay: 'rgba(0,0,0,0.5)',
};

// Props:
// { visible, onClose, onSubmit, communityName, screeningQuestions }
// screeningQuestions: [{ questionId, question }]
const JoinRequestModal = ({
  visible,
  onClose,
  onSubmit,
  communityName,
  screeningQuestions,
}) => {
  const questions = useMemo(() => {
    const arr = Array.isArray(screeningQuestions) ? screeningQuestions : [];
    return arr
      .map((q) => ({
        questionId: q?.questionId || q?.id || '',
        question: (q?.question || '').trim(),
      }))
      .filter((q) => q.questionId && q.question);
  }, [screeningQuestions]);

  const [submitting, setSubmitting] = useState(false);
  const [answersById, setAnswersById] = useState({});

  useEffect(() => {
    if (!visible) return;
    const initial = {};
    questions.forEach((q) => {
      initial[q.questionId] = '';
    });
    setAnswersById(initial);
    setSubmitting(false);
  }, [visible, questions]);

  const handleChange = (questionId, value) => {
    setAnswersById((prev) => ({ ...prev, [questionId]: value }));
  };

  const validate = () => {
    if (!questions.length) return { ok: true };

    for (const q of questions) {
      const val = (answersById[q.questionId] || '').trim();
      if (val.length < 10) {
        return {
          ok: false,
          message: 'Please fill all answers (min 10 characters each).',
        };
      }
    }
    return { ok: true };
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const v = validate();
    if (!v.ok) {
      // Keep it simple: show inline message via alert-like text
      // Caller can also show Alert; but spec wants modal UX and success message handled by screen.
      // We'll just block submission here.
      return;
    }

    const answers = questions.map((q) => ({
      questionId: q.questionId,
      question: q.question,
      answer: (answersById[q.questionId] || '').trim(),
    }));

    setSubmitting(true);
    try {
      await onSubmit(answers);
    } finally {
      setSubmitting(false);
    }
  };

  const contentMessage = questions.length
    ? 'Please answer these questions from the community admins:'
    : 'This is a private community. Your join request will be sent to the admins for approval.';

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Request to Join</Text>
              <Text style={styles.communityName} numberOfLines={1}>
                {communityName || ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={submitting}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.message}>{contentMessage}</Text>

          {questions.length ? (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.questionsScroll}>
              {questions.map((q, idx) => (
                <View key={q.questionId} style={styles.questionBlock}>
                  <Text style={styles.questionText}>
                    {idx + 1}. {q.question}
                  </Text>
                  <TextInput
                    style={styles.answerInput}
                    value={answersById[q.questionId] || ''}
                    onChangeText={(t) => handleChange(q.questionId, t)}
                    placeholder="Type your answer..."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    textAlignVertical="top"
                    editable={!submitting}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noQuestionsSpacer} />
          )}

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.cancelButton, submitting && styles.buttonDisabled]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityLabel="Send Request"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.sendText}>Send Request</Text>
              )}
            </TouchableOpacity>
          </View>

          {questions.length ? (
            <Text style={styles.hintText}>All answers must be at least 10 characters.</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  communityName: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 4,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 16,
  },
  questionsScroll: {
    marginBottom: 16,
  },
  questionBlock: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 80,
    fontSize: 14,
    color: COLORS.text,
  },
  noQuestionsSpacer: {
    height: 8,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textLight,
  },
  sendButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  hintText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});

export default JoinRequestModal;
