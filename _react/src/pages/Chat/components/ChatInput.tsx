import {
  ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  LuArrowUp,
  LuCircleStop,
  LuMic,
  LuPaperclip,
  LuSquare,
} from 'react-icons/lu';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { useNavigate } from 'react-router';
import { AutoSizingTextArea, Button, Icon, Label } from '../../../components';
import { useFileUpload } from '../../../hooks/useFileUpload';
import SpeechToText, {
  IS_SPEECH_RECOGNITION_SUPPORTED,
  SpeechRecordCallback,
} from '../../../hooks/useSpeechToText';
import { useChatContext } from '../../../store/chat';
import { MessageExtra } from '../../../types';
import { usePrefilledMessage } from '../hooks/usePrefilledMessage';
import { DropzoneArea } from './DropzoneArea';

type CallbackSendMessage = (
  content: string,
  extra: MessageExtra[] | undefined
) => Promise<boolean>;

export const ChatInput = memo(
  ({ convId, onSend }: { convId?: string; onSend: CallbackSendMessage }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { prefilledContent, isPrefilledSend } = usePrefilledMessage();
    const extraContext = useFileUpload();
    const { isGenerating, stopGenerating } = useChatContext();

    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [textAreaValue, setTextAreaValue] = useState('');

    const isPending = useMemo(
      () => (!convId ? false : isGenerating(convId)),
      [convId, isGenerating]
    );

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        setTextAreaValue(event.target.value);
      },
      []
    );

    const handleStop = useCallback(() => {
      if (!convId) return;
      stopGenerating(convId);
    }, [convId, stopGenerating]);

    const handleRecord: SpeechRecordCallback = useCallback((text: string) => {
      setTextAreaValue(text);
    }, []);

    const sendNewMessage = async () => {
      const lastInpMsg = textAreaValue;
      if (lastInpMsg.trim().length === 0) {
        toast.error(t('chatInput.errors.emptyMessage'));
        return;
      }

      setTextAreaValue('');
      if (!(await onSend(lastInpMsg, extraContext.items))) {
        // restore the input message if failed
        setTextAreaValue(lastInpMsg);
      }
      // OK
      extraContext.clearItems();
    };

    useEffect(() => {
      if (!textAreaRef.current) return;

      // set textarea with prefilled value
      if (prefilledContent) {
        setTextAreaValue(prefilledContent);
      }

      // send the prefilled message if needed
      // otherwise, focus on the input
      if (isPrefilledSend) sendNewMessage();
      else textAreaRef.current.focus();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPrefilledSend, prefilledContent]);

    return (
      <div
        className="group shrink-0 w-full md:max-w-md focus-within:md:max-w-2xl lg:max-w-lg focus-within:lg:max-w-3xl xl:max-w-3xl focus-within:xl:max-w-4xl bg-base-100 mx-auto p-1 md:p-2"
        aria-label={t('chatInput.ariaLabels.chatInput')}
      >
        <DropzoneArea
          inputId="new-message-file-upload"
          extraContext={extraContext}
          disabled={isPending}
        >
          <div
            className="bg-base-200 flex flex-col outline-0 focus-within:outline-1 rounded-lg shadow-sm xl:shadow-md p-2"
            tabIndex={0}
          >
            <AutoSizingTextArea
              // Default (mobile): Enable vertical resize, overflow auto for scrolling if needed
              // Large screens (lg:): Disable manual resize, apply max-height for autosize limit
              className="text-base p-0 px-2 max-md:min-h-12"
              variant="transparent"
              size="full"
              placeholder={t('chatInput.placeholder')}
              ref={textAreaRef}
              value={textAreaValue}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendNewMessage();
                }
              }}
              rows={1}
            />

            {/* buttons area */}
            <div className="hidden group-focus-within:flex items-center justify-between mt-2">
              <div className="flex gap-2 items-center">
                <Label
                  className={isPending ? 'btn-disabled' : ''}
                  variant="btn-ghost"
                  size="icon-xl"
                  htmlFor="new-message-file-upload"
                  aria-label={t('chatInput.ariaLabels.uploadFile')}
                  tabIndex={0}
                  role="button"
                >
                  <Icon size="md">
                    <LuPaperclip />
                  </Icon>
                </Label>

                <Button
                  className="xl:hidden"
                  variant="ghost"
                  size="icon-xl"
                  title={t('header.title.settings')}
                  aria-label={t('header.ariaLabels.settings')}
                  onClick={() => navigate('/settings')}
                >
                  <TbAdjustmentsHorizontal className="lucide h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center">
                {IS_SPEECH_RECOGNITION_SUPPORTED && !isPending && (
                  <SpeechToText onRecord={handleRecord}>
                    {({ isRecording, startRecording, stopRecording }) => (
                      <>
                        {!isRecording && (
                          <Button
                            className="mr-2"
                            variant="ghost"
                            size="icon-xl"
                            onClick={startRecording}
                            title="Record"
                            aria-label="Start Recording"
                          >
                            <Icon size="md">
                              <LuMic />
                            </Icon>
                          </Button>
                        )}
                        {isRecording && (
                          <Button
                            className="mr-2"
                            variant="ghost"
                            size="icon-xl"
                            onClick={stopRecording}
                            title="Stop"
                            aria-label="Stop Recording"
                          >
                            <Icon size="md">
                              <LuCircleStop />
                            </Icon>
                          </Button>
                        )}
                      </>
                    )}
                  </SpeechToText>
                )}

                {isPending && (
                  <Button variant="neutral" size="icon-xl" onClick={handleStop}>
                    <Icon size="sm" variant="current">
                      <LuSquare />
                    </Icon>
                  </Button>
                )}

                {!isPending && (
                  <Button
                    variant="neutral"
                    size="icon-xl"
                    onClick={sendNewMessage}
                    aria-label={t('chatInput.ariaLabels.send')}
                  >
                    <Icon size="md">
                      <LuArrowUp />
                    </Icon>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DropzoneArea>
      </div>
    );
  }
);
