package studio.hancut.ui;

import studio.hancut.model.Caption;
import studio.hancut.model.Clip;
import studio.hancut.model.MediaItem;
import studio.hancut.model.MediaType;
import studio.hancut.model.ProjectData;
import studio.hancut.service.FfmpegExportService;
import studio.hancut.service.FramePreviewService;
import studio.hancut.service.MediaProbeService;
import studio.hancut.service.ProjectService;
import studio.hancut.service.SceneGenerator;
import studio.hancut.service.SrtService;
import studio.hancut.service.ToolLocator;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.DefaultListCellRenderer;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JColorChooser;
import javax.swing.JComboBox;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JProgressBar;
import javax.swing.JScrollPane;
import javax.swing.JSlider;
import javax.swing.JSpinner;
import javax.swing.JSplitPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.JToolBar;
import javax.swing.ListSelectionModel;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import javax.swing.Timer;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.GridLayout;
import java.awt.Insets;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

public final class MainFrame extends JFrame {
    private static final Color BG = new Color(17, 21, 30);
    private static final Color PANEL = new Color(25, 31, 43);
    private static final Color PANEL_2 = new Color(32, 39, 54);
    private static final Color TEXT = new Color(231, 235, 243);
    private static final Color MUTED = new Color(145, 154, 175);
    private static final Color ACCENT = new Color(116, 101, 255);

    private ProjectData project = new ProjectData();
    private Path projectPath;
    private boolean dirty;
    private boolean syncingSelection;
    private boolean playing;
    private double currentTime;
    private int previewRequest;

    private final ProjectService projectService = new ProjectService();
    private final MediaProbeService mediaProbe = new MediaProbeService();
    private final FramePreviewService framePreview = new FramePreviewService();
    private final SceneGenerator sceneGenerator = new SceneGenerator();
    private final SrtService srtService = new SrtService();
    private final FfmpegExportService exporter = new FfmpegExportService();

    private final DefaultListModel<MediaItem> mediaModel = new DefaultListModel<>();
    private final DefaultListModel<Clip> timelineModel = new DefaultListModel<>();
    private final DefaultListModel<Caption> captionModel = new DefaultListModel<>();
    private final JList<MediaItem> mediaList = new JList<>(mediaModel);
    private final JList<Clip> timelineList = new JList<>(timelineModel);
    private final JList<Caption> captionList = new JList<>(captionModel);
    private final PreviewCanvas preview = new PreviewCanvas();
    private final JSlider playhead = new JSlider(0, 10_000, 0);
    private final JLabel timeLabel = new JLabel("00:00.0 / 00:00.0");
    private final JLabel statusLabel = new JLabel("준비");
    private final JProgressBar progress = new JProgressBar(0, 100);
    private final JButton playButton = button("▶ 재생");

    private final JSpinner sourceStartSpinner = new JSpinner(new SpinnerNumberModel(0d, 0d, 86_400d, 0.1d));
    private final JSpinner durationSpinner = new JSpinner(new SpinnerNumberModel(5d, 0.2d, 86_400d, 0.1d));
    private final JTextArea overlayText = new JTextArea(5, 18);
    private final JCheckBox fadeCheck = new JCheckBox("장면 시작/끝 페이드", true);
    private final JButton colorButton = button("배경색 선택");
    private final JComboBox<String> outputProfile = new JComboBox<>(new String[]{
            "가로 Full HD · 1920×1080", "세로 Shorts · 1080×1920", "정사각형 · 1080×1080", "HD · 1280×720"
    });
    private final JSpinner fpsSpinner = new JSpinner(new SpinnerNumberModel(30, 15, 60, 1));

    private final Timer playbackTimer = new Timer(500, event -> advancePlayback());

    public MainFrame() {
        super("HanCut Studio");
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
        setMinimumSize(new Dimension(1100, 720));
        setSize(1480, 900);
        setLocationRelativeTo(null);
        getContentPane().setBackground(BG);
        setJMenuBar(createMenuBar());
        add(createToolbar(), BorderLayout.NORTH);
        add(createWorkspace(), BorderLayout.CENTER);
        add(createStatusBar(), BorderLayout.SOUTH);
        configureLists();
        configureActions();
        refreshProjectViews();
        addWindowListener(new WindowAdapter() {
            @Override public void windowClosing(WindowEvent event) { attemptClose(); }
        });
    }

    private JMenuBar createMenuBar() {
        JMenuBar bar = new JMenuBar();
        JMenu file = new JMenu("파일");
        file.add(item("새 프로젝트", event -> newProject()));
        file.add(item("프로젝트 열기…", event -> openProject()));
        file.add(item("저장", event -> saveProject(false)));
        file.add(item("다른 이름으로 저장…", event -> saveProject(true)));
        file.addSeparator();
        file.add(item("MP4 내보내기…", event -> exportVideo()));
        file.addSeparator();
        file.add(item("종료", event -> attemptClose()));
        JMenu edit = new JMenu("편집");
        edit.add(item("재생 위치에서 분할", event -> splitClip()));
        edit.add(item("클립 복제", event -> duplicateClip()));
        edit.add(item("선택 삭제", event -> deleteSelectedClip()));
        JMenu help = new JMenu("도움말");
        help.add(item("FFmpeg 상태", event -> showToolStatus()));
        help.add(item("HanCut Studio 정보", event -> JOptionPane.showMessageDialog(this,
                "HanCut Studio 0.1\n로컬 우선 Windows 영상 편집 MVP", "정보", JOptionPane.INFORMATION_MESSAGE)));
        bar.add(file); bar.add(edit); bar.add(help);
        return bar;
    }

    private JToolBar createToolbar() {
        JToolBar bar = new JToolBar();
        bar.setFloatable(false);
        bar.setBorder(BorderFactory.createEmptyBorder(7, 8, 7, 8));
        bar.setBackground(PANEL);
        JLabel brand = new JLabel(" HanCut Studio ");
        brand.setForeground(TEXT);
        brand.setFont(brand.getFont().deriveFont(Font.BOLD, 17f));
        bar.add(brand);
        bar.addSeparator(new Dimension(18, 1));
        JButton importButton = button("＋ 미디어");
        importButton.addActionListener(event -> importMedia());
        JButton titleButton = button("T 제목 장면");
        titleButton.addActionListener(event -> addTitleClip());
        JButton generateButton = button("✦ 텍스트→영상");
        generateButton.addActionListener(event -> generateScenes());
        JButton captionButton = button("CC SRT 자막");
        captionButton.addActionListener(event -> importSrt());
        JButton exportButton = button("내보내기");
        exportButton.addActionListener(event -> exportVideo());
        bar.add(importButton); bar.add(titleButton); bar.add(generateButton); bar.add(captionButton);
        bar.add(Box.createHorizontalGlue());
        exportButton.setBackground(ACCENT);
        bar.add(exportButton);
        return bar;
    }

    private Component createWorkspace() {
        JSplitPane main = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, createMediaPanel(), createEditorAndInspector());
        main.setResizeWeight(0.16);
        main.setDividerLocation(235);
        main.setBorder(null);
        return main;
    }

    private Component createMediaPanel() {
        JPanel panel = panel(new BorderLayout(6, 6));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 8));
        panel.add(sectionLabel("미디어 보관함"), BorderLayout.NORTH);
        mediaList.setBackground(PANEL_2);
        mediaList.setForeground(TEXT);
        mediaList.setFixedCellHeight(54);
        panel.add(new JScrollPane(mediaList), BorderLayout.CENTER);
        JButton add = button("선택 항목을 타임라인에 추가");
        add.addActionListener(event -> addSelectedMedia());
        panel.add(add, BorderLayout.SOUTH);
        return panel;
    }

    private Component createEditorAndInspector() {
        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, createEditorPanel(), createInspector());
        split.setResizeWeight(0.79);
        split.setDividerLocation(900);
        split.setBorder(null);
        return split;
    }

    private Component createEditorPanel() {
        JPanel editor = panel(new BorderLayout(8, 8));
        editor.setBorder(BorderFactory.createEmptyBorder(10, 8, 8, 8));
        preview.setPreferredSize(new Dimension(850, 480));
        editor.add(preview, BorderLayout.CENTER);

        JPanel lower = panel(new BorderLayout(6, 6));
        JPanel transport = panel(new BorderLayout(8, 0));
        playButton.addActionListener(event -> togglePlayback());
        transport.add(playButton, BorderLayout.WEST);
        playhead.setBackground(PANEL);
        transport.add(playhead, BorderLayout.CENTER);
        timeLabel.setForeground(TEXT);
        timeLabel.setPreferredSize(new Dimension(135, 28));
        transport.add(timeLabel, BorderLayout.EAST);
        lower.add(transport, BorderLayout.NORTH);

        JPanel timeline = panel(new BorderLayout(5, 5));
        JPanel timelineTools = panel(new FlowLayout(FlowLayout.LEFT, 5, 0));
        timelineTools.add(sectionLabel("타임라인"));
        timelineTools.add(actionButton("✂ 분할", this::splitClip));
        timelineTools.add(actionButton("복제", this::duplicateClip));
        timelineTools.add(actionButton("←", () -> moveClip(-1)));
        timelineTools.add(actionButton("→", () -> moveClip(1)));
        timelineTools.add(actionButton("삭제", this::deleteSelectedClip));
        timeline.add(timelineTools, BorderLayout.NORTH);
        timelineList.setLayoutOrientation(JList.HORIZONTAL_WRAP);
        timelineList.setVisibleRowCount(1);
        timelineList.setFixedCellWidth(180);
        timelineList.setFixedCellHeight(82);
        timelineList.setBackground(new Color(12, 16, 24));
        timelineList.setForeground(TEXT);
        JScrollPane timelineScroll = new JScrollPane(timelineList);
        timelineScroll.setPreferredSize(new Dimension(600, 116));
        timeline.add(timelineScroll, BorderLayout.CENTER);
        lower.add(timeline, BorderLayout.CENTER);
        editor.add(lower, BorderLayout.SOUTH);
        return editor;
    }

    private Component createInspector() {
        JTabbedPane tabs = new JTabbedPane();
        tabs.addTab("클립", createClipInspector());
        tabs.addTab("자막", createCaptionPanel());
        tabs.addTab("출력", createOutputPanel());
        tabs.setPreferredSize(new Dimension(290, 650));
        return tabs;
    }

    private Component createClipInspector() {
        JPanel panel = panel(new GridBagLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(14, 12, 14, 12));
        GridBagConstraints c = constraints();
        addField(panel, c, "원본 시작(초)", sourceStartSpinner);
        addField(panel, c, "클립 길이(초)", durationSpinner);
        c.gridx = 0; c.gridy++; c.gridwidth = 2; c.fill = GridBagConstraints.HORIZONTAL;
        JLabel textLabel = new JLabel("화면 텍스트"); textLabel.setForeground(MUTED); panel.add(textLabel, c);
        c.gridy++; c.weighty = 0.3; c.fill = GridBagConstraints.BOTH;
        overlayText.setLineWrap(true); overlayText.setWrapStyleWord(true);
        panel.add(new JScrollPane(overlayText), c);
        c.gridy++; c.weighty = 0; c.fill = GridBagConstraints.HORIZONTAL;
        styleCheckBox(fadeCheck); panel.add(fadeCheck, c);
        c.gridy++; panel.add(colorButton, c);
        c.gridy++;
        JButton apply = button("클립 속성 적용"); apply.setBackground(ACCENT); panel.add(apply, c);
        apply.addActionListener(event -> applyClipProperties());
        c.gridy++; c.weighty = 1; panel.add(Box.createVerticalGlue(), c);
        return panel;
    }

    private Component createCaptionPanel() {
        JPanel panel = panel(new BorderLayout(6, 6));
        panel.setBorder(BorderFactory.createEmptyBorder(12, 10, 10, 10));
        captionList.setBackground(PANEL_2); captionList.setForeground(TEXT);
        panel.add(new JScrollPane(captionList), BorderLayout.CENTER);
        JPanel buttons = panel(new GridLayout(0, 1, 4, 4));
        buttons.add(actionButton("＋ 자막 추가", this::addCaption));
        buttons.add(actionButton("SRT 가져오기", this::importSrt));
        buttons.add(actionButton("선택 자막 삭제", this::deleteCaption));
        panel.add(buttons, BorderLayout.SOUTH);
        return panel;
    }

    private Component createOutputPanel() {
        JPanel panel = panel(new GridBagLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(14, 12, 14, 12));
        GridBagConstraints c = constraints();
        addField(panel, c, "화면 비율/해상도", outputProfile);
        addField(panel, c, "초당 프레임", fpsSpinner);
        c.gridx = 0; c.gridy++; c.gridwidth = 2; c.fill = GridBagConstraints.HORIZONTAL;
        JButton apply = button("출력 설정 적용"); apply.addActionListener(event -> applyOutputSettings()); panel.add(apply, c);
        c.gridy++; c.weighty = 1; panel.add(Box.createVerticalGlue(), c);
        return panel;
    }

    private Component createStatusBar() {
        JPanel bar = panel(new BorderLayout(8, 0));
        bar.setBorder(BorderFactory.createEmptyBorder(5, 10, 5, 10));
        statusLabel.setForeground(MUTED);
        progress.setPreferredSize(new Dimension(190, 18));
        progress.setStringPainted(true);
        progress.setVisible(false);
        bar.add(statusLabel, BorderLayout.CENTER);
        bar.add(progress, BorderLayout.EAST);
        return bar;
    }

    private void configureLists() {
        mediaList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        mediaList.setCellRenderer(new DefaultListCellRenderer() {
            @Override public Component getListCellRendererComponent(JList<?> list, Object value, int index,
                                                                     boolean selected, boolean focus) {
                JLabel label = (JLabel) super.getListCellRendererComponent(list, value, index, selected, focus);
                MediaItem item = (MediaItem) value;
                label.setText("<html><b>" + html(item.name()) + "</b><br><span style='color:#9aa3b8'>" +
                        item.type().label() + " · " + formatTime(item.duration()) + "</span></html>");
                label.setBorder(BorderFactory.createEmptyBorder(4, 7, 4, 7));
                return label;
            }
        });
        mediaList.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override public void mouseClicked(java.awt.event.MouseEvent event) {
                if (event.getClickCount() == 2) addSelectedMedia();
            }
        });

        timelineList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        timelineList.setCellRenderer(new DefaultListCellRenderer() {
            @Override public Component getListCellRendererComponent(JList<?> list, Object value, int index,
                                                                     boolean selected, boolean focus) {
                JLabel label = (JLabel) super.getListCellRendererComponent(list, value, index, selected, focus);
                Clip clip = (Clip) value;
                String title = clip.generated() ? "✦ 생성 장면" : project.mediaById(clip.mediaId()).map(MediaItem::name).orElse("누락된 미디어");
                label.setText("<html><b>" + (index + 1) + ". " + html(title) + "</b><br>" +
                        formatTime(clip.duration()) + (clip.fade() ? " · 페이드" : "") + "</html>");
                label.setHorizontalAlignment(SwingConstants.LEFT);
                label.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createLineBorder(selected ? ACCENT : new Color(61, 69, 88), 2),
                        BorderFactory.createEmptyBorder(8, 9, 8, 9)));
                label.setBackground(selected ? new Color(62, 55, 118) : PANEL_2);
                label.setForeground(TEXT);
                label.setOpaque(true);
                return label;
            }
        });
        timelineList.addListSelectionListener(event -> {
            if (event.getValueIsAdjusting()) return;
            loadInspector();
            int index = timelineList.getSelectedIndex();
            if (index >= 0 && !syncingSelection) {
                currentTime = project.clipStart(index);
                updatePlayhead();
                refreshPreview();
            }
        });
        captionList.setCellRenderer(new DefaultListCellRenderer() {
            @Override public Component getListCellRendererComponent(JList<?> list, Object value, int index,
                                                                     boolean selected, boolean focus) {
                JLabel label = (JLabel) super.getListCellRendererComponent(list, value, index, selected, focus);
                Caption caption = (Caption) value;
                label.setText("<html><b>" + formatTime(caption.start()) + "–" + formatTime(caption.end()) +
                        "</b><br>" + html(caption.text()) + "</html>");
                label.setBorder(BorderFactory.createEmptyBorder(5, 6, 5, 6));
                return label;
            }
        });
    }

    private void configureActions() {
        playhead.addChangeListener(event -> {
            if (playhead.getValueIsAdjusting()) return;
            double total = project.totalDuration();
            currentTime = total <= 0 ? 0 : total * playhead.getValue() / 10_000d;
            syncTimelineSelection();
            updateTimeLabel();
            refreshPreview();
        });
        colorButton.addActionListener(event -> {
            Clip clip = timelineList.getSelectedValue();
            if (clip == null || !clip.generated()) return;
            Color selected = JColorChooser.showDialog(this, "장면 배경색", new Color(clip.backgroundRgb()));
            if (selected != null) {
                clip.setBackgroundRgb(selected.getRGB() & 0xFFFFFF);
                markDirty(); refreshPreview();
            }
        });
    }

    private void importMedia() {
        JFileChooser chooser = new JFileChooser();
        chooser.setDialogTitle("미디어 가져오기");
        chooser.setMultiSelectionEnabled(true);
        chooser.setFileFilter(new FileNameExtensionFilter("영상, 오디오, 이미지",
                "mp4", "mov", "mkv", "avi", "webm", "m4v", "mp3", "wav", "m4a", "aac", "flac", "ogg",
                "jpg", "jpeg", "png", "webp", "bmp", "gif"));
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) return;
        File[] files = chooser.getSelectedFiles();
        setBusy(true, "미디어 분석 중");
        new SwingWorker<List<MediaItem>, Void>() {
            @Override protected List<MediaItem> doInBackground() throws Exception {
                List<MediaItem> result = new ArrayList<>();
                for (File file : files) result.add(mediaProbe.probe(file.toPath()));
                return result;
            }
            @Override protected void done() {
                try {
                    for (MediaItem item : get()) project.media().add(item);
                    markDirty(); refreshProjectViews(); status("미디어 " + files.length + "개를 가져왔습니다.");
                } catch (Exception error) { showError("미디어 가져오기 실패", rootMessage(error)); }
                finally { setBusy(false, null); }
            }
        }.execute();
    }

    private void addSelectedMedia() {
        MediaItem media = mediaList.getSelectedValue();
        if (media == null) { status("먼저 미디어를 선택하세요."); return; }
        double duration = media.type() == MediaType.IMAGE ? 5 : media.duration();
        Clip clip = new Clip(media.id(), duration);
        project.clips().add(clip);
        markDirty(); refreshTimeline();
        timelineList.setSelectedIndex(project.clips().size() - 1);
    }

    private void addTitleClip() {
        JTextArea text = new JTextArea(4, 32); text.setLineWrap(true); text.setWrapStyleWord(true);
        JSpinner duration = new JSpinner(new SpinnerNumberModel(3d, 0.5d, 60d, 0.5d));
        JPanel form = new JPanel(new BorderLayout(5, 5));
        form.add(new JLabel("화면에 표시할 제목"), BorderLayout.NORTH);
        form.add(new JScrollPane(text), BorderLayout.CENTER);
        JPanel bottom = new JPanel(new FlowLayout(FlowLayout.LEFT)); bottom.add(new JLabel("길이(초)")); bottom.add(duration); form.add(bottom, BorderLayout.SOUTH);
        if (JOptionPane.showConfirmDialog(this, form, "제목 장면 만들기", JOptionPane.OK_CANCEL_OPTION) != JOptionPane.OK_OPTION) return;
        if (text.getText().isBlank()) return;
        project.clips().add(Clip.generated(text.getText().strip(), ((Number) duration.getValue()).doubleValue(), 0x24314D));
        markDirty(); refreshTimeline(); timelineList.setSelectedIndex(project.clips().size() - 1);
    }

    private void generateScenes() {
        JTextArea script = new JTextArea(11, 44); script.setLineWrap(true); script.setWrapStyleWord(true);
        script.setText("소개할 내용을 문장별로 입력하세요.\n각 문장이 하나의 영상 장면으로 생성됩니다.");
        JSpinner duration = new JSpinner(new SpinnerNumberModel(3.5d, 1d, 30d, 0.5d));
        JPanel form = new JPanel(new BorderLayout(6, 6));
        form.add(new JLabel("대본 또는 아이디어"), BorderLayout.NORTH); form.add(new JScrollPane(script), BorderLayout.CENTER);
        JPanel bottom = new JPanel(new FlowLayout(FlowLayout.LEFT)); bottom.add(new JLabel("장면당 초")); bottom.add(duration); form.add(bottom, BorderLayout.SOUTH);
        if (JOptionPane.showConfirmDialog(this, form, "오프라인 텍스트→영상 초안", JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE) != JOptionPane.OK_OPTION) return;
        List<Clip> generated = sceneGenerator.generate(script.getText(), ((Number) duration.getValue()).doubleValue());
        if (generated.isEmpty()) { status("생성할 문장을 입력하세요."); return; }
        project.clips().addAll(generated);
        markDirty(); refreshTimeline(); timelineList.setSelectedIndex(project.clips().size() - generated.size());
        status("장면 " + generated.size() + "개를 생성했습니다.");
    }

    private void splitClip() {
        int index = timelineList.getSelectedIndex();
        if (index < 0) { status("분할할 클립을 선택하세요."); return; }
        Clip clip = project.clips().get(index);
        double offset = currentTime - project.clipStart(index);
        if (offset < 0.2 || offset > clip.duration() - 0.2) {
            status("재생 위치를 클립 안쪽으로 옮긴 후 분할하세요."); return;
        }
        Clip right = clip.copy();
        right.setDuration(clip.duration() - offset);
        if (!right.generated()) right.setSourceStart(clip.sourceStart() + offset);
        clip.setDuration(offset);
        project.clips().add(index + 1, right);
        markDirty(); refreshTimeline(); timelineList.setSelectedIndex(index + 1);
    }

    private void duplicateClip() {
        int index = timelineList.getSelectedIndex();
        if (index < 0) return;
        project.clips().add(index + 1, project.clips().get(index).copy());
        markDirty(); refreshTimeline(); timelineList.setSelectedIndex(index + 1);
    }

    private void moveClip(int delta) {
        int index = timelineList.getSelectedIndex();
        int target = index + delta;
        if (index < 0 || target < 0 || target >= project.clips().size()) return;
        Clip clip = project.clips().remove(index); project.clips().add(target, clip);
        markDirty(); refreshTimeline(); timelineList.setSelectedIndex(target);
    }

    private void deleteSelectedClip() {
        int index = timelineList.getSelectedIndex();
        if (index < 0) return;
        project.clips().remove(index);
        markDirty(); refreshTimeline();
        if (!project.clips().isEmpty()) timelineList.setSelectedIndex(Math.min(index, project.clips().size() - 1));
        else { currentTime = 0; updatePlayhead(); preview.setMessage("타임라인이 비어 있습니다"); }
    }

    private void loadInspector() {
        Clip clip = timelineList.getSelectedValue();
        boolean enabled = clip != null;
        sourceStartSpinner.setEnabled(enabled && !clip.generated());
        durationSpinner.setEnabled(enabled);
        overlayText.setEnabled(enabled);
        fadeCheck.setEnabled(enabled);
        colorButton.setEnabled(enabled && clip.generated());
        if (!enabled) return;
        sourceStartSpinner.setValue(clip.sourceStart());
        durationSpinner.setValue(clip.duration());
        overlayText.setText(clip.overlayText());
        fadeCheck.setSelected(clip.fade());
    }

    private void applyClipProperties() {
        Clip clip = timelineList.getSelectedValue();
        if (clip == null) return;
        double start = ((Number) sourceStartSpinner.getValue()).doubleValue();
        double duration = ((Number) durationSpinner.getValue()).doubleValue();
        if (!clip.generated()) {
            MediaItem media = project.mediaById(clip.mediaId()).orElse(null);
            if (media != null && media.type() != MediaType.IMAGE && start + duration > media.duration() + 0.01) {
                showError("트림 범위 오류", "원본 길이(%.2f초)를 넘을 수 없습니다.".formatted(media.duration())); return;
            }
            clip.setSourceStart(start);
        }
        clip.setDuration(duration); clip.setOverlayText(overlayText.getText().strip()); clip.setFade(fadeCheck.isSelected());
        markDirty(); refreshTimeline(); refreshPreview(); status("클립 속성을 적용했습니다.");
    }

    private void addCaption() {
        JSpinner start = new JSpinner(new SpinnerNumberModel(currentTime, 0d, 86_400d, 0.1d));
        JSpinner end = new JSpinner(new SpinnerNumberModel(currentTime + 2.5, 0.1d, 86_400d, 0.1d));
        JTextArea text = new JTextArea(4, 28); text.setLineWrap(true); text.setWrapStyleWord(true);
        JPanel form = new JPanel(new GridLayout(0, 1, 3, 3));
        form.add(new JLabel("시작(초)")); form.add(start); form.add(new JLabel("끝(초)")); form.add(end);
        form.add(new JLabel("자막")); form.add(new JScrollPane(text));
        if (JOptionPane.showConfirmDialog(this, form, "자막 추가", JOptionPane.OK_CANCEL_OPTION) != JOptionPane.OK_OPTION) return;
        try {
            project.captions().add(new Caption(((Number) start.getValue()).doubleValue(), ((Number) end.getValue()).doubleValue(), text.getText()));
            project.captions().sort(java.util.Comparator.comparingDouble(Caption::start));
            markDirty(); refreshCaptions(); refreshPreview();
        } catch (IllegalArgumentException error) { showError("자막 오류", error.getMessage()); }
    }

    private void importSrt() {
        JFileChooser chooser = new JFileChooser(); chooser.setFileFilter(new FileNameExtensionFilter("SubRip 자막", "srt"));
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) return;
        try {
            List<Caption> captions = srtService.read(chooser.getSelectedFile().toPath());
            project.captions().addAll(captions); project.captions().sort(java.util.Comparator.comparingDouble(Caption::start));
            markDirty(); refreshCaptions(); refreshPreview(); status("자막 " + captions.size() + "개를 가져왔습니다.");
        } catch (Exception error) { showError("SRT 가져오기 실패", error.getMessage()); }
    }

    private void deleteCaption() {
        int index = captionList.getSelectedIndex(); if (index < 0) return;
        project.captions().remove(index); markDirty(); refreshCaptions(); refreshPreview();
    }

    private void applyOutputSettings() {
        int[][] sizes = {{1920, 1080}, {1080, 1920}, {1080, 1080}, {1280, 720}};
        int index = Math.max(0, outputProfile.getSelectedIndex());
        project.output().setSize(sizes[index][0], sizes[index][1]);
        project.output().setFps(((Number) fpsSpinner.getValue()).intValue());
        markDirty(); refreshPreview(); status("출력: " + project.output());
    }

    private void togglePlayback() {
        if (project.clips().isEmpty()) return;
        playing = !playing;
        if (playing) {
            if (currentTime >= project.totalDuration() - 0.05) currentTime = 0;
            playbackTimer.start(); playButton.setText("❚❚ 일시정지");
        } else {
            playbackTimer.stop(); playButton.setText("▶ 재생");
        }
    }

    private void advancePlayback() {
        currentTime += 0.5;
        if (currentTime >= project.totalDuration()) {
            currentTime = project.totalDuration(); playing = false; playbackTimer.stop(); playButton.setText("▶ 재생");
        }
        updatePlayhead(); syncTimelineSelection(); refreshPreview();
    }

    private void refreshPreview() {
        int index = project.clipIndexAt(currentTime);
        if (index < 0 || index >= project.clips().size()) { preview.setMessage("미디어를 가져와 타임라인에 추가하세요"); return; }
        Clip clip = project.clips().get(index);
        double within = Math.max(0, currentTime - project.clipStart(index));
        String caption = project.captions().stream().filter(item -> currentTime >= item.start() && currentTime < item.end())
                .map(Caption::text).findFirst().orElse("");
        int request = ++previewRequest;
        status("미리보기 준비 중…");
        new SwingWorker<BufferedImage, Void>() {
            @Override protected BufferedImage doInBackground() throws Exception { return framePreview.frame(project, clip, within); }
            @Override protected void done() {
                if (request != previewRequest) return;
                try {
                    preview.setContent(get(), clip.generated() ? "" : clip.overlayText(), caption);
                    status("준비");
                } catch (Exception error) { preview.setMessage(rootMessage(error)); status("미리보기 제한: " + rootMessage(error)); }
            }
        }.execute();
    }

    private void newProject() {
        if (!confirmDiscard()) return;
        project = new ProjectData(); projectPath = null; dirty = false; currentTime = 0; refreshProjectViews();
    }

    private void openProject() {
        if (!confirmDiscard()) return;
        JFileChooser chooser = new JFileChooser(); chooser.setFileFilter(new FileNameExtensionFilter("HanCut 프로젝트", "hancut"));
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) return;
        try {
            project = projectService.load(chooser.getSelectedFile().toPath()); projectPath = chooser.getSelectedFile().toPath();
            dirty = false; currentTime = 0; refreshProjectViews(); status("프로젝트를 열었습니다.");
        } catch (Exception error) { showError("프로젝트 열기 실패", error.getMessage()); }
    }

    private boolean saveProject(boolean saveAs) {
        if (saveAs || projectPath == null) {
            JFileChooser chooser = new JFileChooser(); chooser.setFileFilter(new FileNameExtensionFilter("HanCut 프로젝트", "hancut"));
            chooser.setSelectedFile(new File(project.name().replaceAll("[^가-힣a-zA-Z0-9._-]", "_") + ".hancut"));
            if (chooser.showSaveDialog(this) != JFileChooser.APPROVE_OPTION) return false;
            projectPath = withExtension(chooser.getSelectedFile().toPath(), ".hancut");
        }
        try {
            projectService.save(project, projectPath); dirty = false; updateTitle(); status("프로젝트를 저장했습니다."); return true;
        } catch (Exception error) { showError("저장 실패", error.getMessage()); return false; }
    }

    private void exportVideo() {
        applyOutputSettings();
        if (project.clips().isEmpty()) { status("내보낼 클립이 없습니다."); return; }
        if (ToolLocator.ffmpeg() == null) { showToolStatus(); return; }
        JFileChooser chooser = new JFileChooser(); chooser.setFileFilter(new FileNameExtensionFilter("MP4 영상", "mp4"));
        chooser.setSelectedFile(new File(project.name().replaceAll("[^가-힣a-zA-Z0-9._-]", "_") + ".mp4"));
        if (chooser.showSaveDialog(this) != JFileChooser.APPROVE_OPTION) return;
        Path destination = withExtension(chooser.getSelectedFile().toPath(), ".mp4");
        setBusy(true, "내보내기 준비 중"); progress.setVisible(true); progress.setValue(0);
        new SwingWorker<Void, ExportProgress>() {
            @Override protected Void doInBackground() throws Exception {
                exporter.export(project, destination, (percent, message) -> publish(new ExportProgress(percent, message)));
                return null;
            }
            @Override protected void process(List<ExportProgress> chunks) {
                ExportProgress last = chunks.get(chunks.size() - 1); progress.setValue(last.percent()); status(last.message());
            }
            @Override protected void done() {
                try {
                    get(); status("완료: " + destination); JOptionPane.showMessageDialog(MainFrame.this,
                            "영상 내보내기가 완료되었습니다.\n" + destination, "완료", JOptionPane.INFORMATION_MESSAGE);
                } catch (Exception error) { showError("내보내기 실패", rootMessage(error)); }
                finally { setBusy(false, null); progress.setVisible(false); }
            }
        }.execute();
    }

    private void refreshProjectViews() {
        mediaModel.clear(); project.media().forEach(mediaModel::addElement);
        refreshTimeline(); refreshCaptions();
        outputProfile.setSelectedIndex(profileIndex()); fpsSpinner.setValue(project.output().fps());
        updatePlayhead(); updateTitle();
        if (project.clips().isEmpty()) preview.setMessage("미디어를 가져와 타임라인에 추가하세요");
        else { timelineList.setSelectedIndex(0); refreshPreview(); }
    }

    private void refreshTimeline() {
        timelineModel.clear(); project.clips().forEach(timelineModel::addElement);
        if (currentTime > project.totalDuration()) currentTime = project.totalDuration();
        updatePlayhead(); timelineList.repaint();
    }

    private void refreshCaptions() { captionModel.clear(); project.captions().forEach(captionModel::addElement); }

    private void updatePlayhead() {
        double total = project.totalDuration();
        int value = total <= 0 ? 0 : (int) Math.min(10_000, Math.round(currentTime / total * 10_000));
        playhead.setValue(value); updateTimeLabel();
    }

    private void updateTimeLabel() { timeLabel.setText(formatTime(currentTime) + " / " + formatTime(project.totalDuration())); }

    private void syncTimelineSelection() {
        int index = project.clipIndexAt(currentTime);
        if (index < 0) return;
        syncingSelection = true; timelineList.setSelectedIndex(index); timelineList.ensureIndexIsVisible(index); syncingSelection = false;
    }

    private int profileIndex() {
        int w = project.output().width(), h = project.output().height();
        if (w == 1080 && h == 1920) return 1; if (w == 1080 && h == 1080) return 2; if (w == 1280 && h == 720) return 3; return 0;
    }

    private void showToolStatus() {
        Path ffmpeg = ToolLocator.ffmpeg(); Path ffprobe = ToolLocator.ffprobe();
        String message = "FFmpeg: " + (ffmpeg == null ? "찾지 못함" : ffmpeg) + "\nFFprobe: " + (ffprobe == null ? "찾지 못함" : ffprobe) +
                "\n\nWindows 배포본의 tools 폴더에 ffmpeg.exe와 ffprobe.exe를 넣거나\nHANCUT_FFMPEG / HANCUT_FFPROBE 환경 변수를 지정하세요.";
        JOptionPane.showMessageDialog(this, message, "FFmpeg 상태", ffmpeg == null ? JOptionPane.WARNING_MESSAGE : JOptionPane.INFORMATION_MESSAGE);
    }

    private boolean confirmDiscard() {
        if (!dirty) return true;
        int choice = JOptionPane.showConfirmDialog(this, "변경 사항을 저장하시겠습니까?", "저장되지 않은 변경",
                JOptionPane.YES_NO_CANCEL_OPTION, JOptionPane.WARNING_MESSAGE);
        if (choice == JOptionPane.CANCEL_OPTION || choice == JOptionPane.CLOSED_OPTION) return false;
        return choice != JOptionPane.YES_OPTION || saveProject(false);
    }

    private void attemptClose() { if (confirmDiscard()) { playbackTimer.stop(); dispose(); System.exit(0); } }

    private void markDirty() { dirty = true; updateTitle(); }
    private void updateTitle() { setTitle("HanCut Studio — " + project.name() + (dirty ? " *" : "")); }
    private void status(String value) { statusLabel.setText(value); }
    private void setBusy(boolean busy, String message) { if (message != null) status(message); setCursor(busy ? java.awt.Cursor.getPredefinedCursor(java.awt.Cursor.WAIT_CURSOR) : java.awt.Cursor.getDefaultCursor()); }

    private JButton button(String text) {
        JButton button = new JButton(text); button.setFocusPainted(false); button.setForeground(TEXT); button.setBackground(PANEL_2);
        button.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createLineBorder(new Color(67, 75, 94)), BorderFactory.createEmptyBorder(7, 10, 7, 10)));
        return button;
    }

    private JButton actionButton(String text, Runnable action) { JButton button = button(text); button.addActionListener(event -> action.run()); return button; }
    private JMenuItem item(String text, java.awt.event.ActionListener action) { JMenuItem item = new JMenuItem(text); item.addActionListener(action); return item; }
    private JPanel panel(java.awt.LayoutManager layout) { JPanel panel = new JPanel(layout); panel.setBackground(PANEL); return panel; }
    private JLabel sectionLabel(String text) { JLabel label = new JLabel(text); label.setForeground(TEXT); label.setFont(label.getFont().deriveFont(Font.BOLD)); return label; }
    private void styleCheckBox(JCheckBox box) { box.setBackground(PANEL); box.setForeground(TEXT); }

    private GridBagConstraints constraints() {
        GridBagConstraints c = new GridBagConstraints(); c.gridx = 0; c.gridy = 0; c.insets = new Insets(4, 3, 4, 3); c.anchor = GridBagConstraints.WEST; return c;
    }

    private void addField(JPanel panel, GridBagConstraints c, String label, Component component) {
        c.gridx = 0; c.gridwidth = 1; c.weightx = 0; c.fill = GridBagConstraints.NONE;
        JLabel fieldLabel = new JLabel(label); fieldLabel.setForeground(MUTED); panel.add(fieldLabel, c);
        c.gridx = 1; c.weightx = 1; c.fill = GridBagConstraints.HORIZONTAL; panel.add(component, c);
        c.gridy++; c.gridx = 0;
    }

    private Path withExtension(Path path, String extension) {
        return path.toString().toLowerCase().endsWith(extension) ? path : Path.of(path + extension);
    }

    private String formatTime(double seconds) {
        int minutes = (int) seconds / 60; double remainder = seconds - minutes * 60;
        return "%02d:%04.1f".formatted(minutes, remainder);
    }

    private String html(String value) { return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>"); }

    private String rootMessage(Throwable error) {
        Throwable current = error;
        if (current instanceof ExecutionException && current.getCause() != null) current = current.getCause();
        while (current.getCause() != null && current.getMessage() == null) current = current.getCause();
        return current.getMessage() == null ? current.toString() : current.getMessage();
    }

    private void showError(String title, String message) { JOptionPane.showMessageDialog(this, message, title, JOptionPane.ERROR_MESSAGE); }
    private record ExportProgress(int percent, String message) { }
}
