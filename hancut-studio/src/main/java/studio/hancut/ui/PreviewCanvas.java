package studio.hancut.ui;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import javax.swing.JPanel;

public final class PreviewCanvas extends JPanel {
    private BufferedImage image;
    private String clipText = "";
    private String captionText = "";
    private String message = "미디어를 가져와 타임라인에 추가하세요";

    public PreviewCanvas() {
        setBackground(new Color(8, 11, 18));
    }

    public void setContent(BufferedImage image, String clipText, String captionText) {
        this.image = image;
        this.clipText = clipText == null ? "" : clipText;
        this.captionText = captionText == null ? "" : captionText;
        this.message = "";
        repaint();
    }

    public void setMessage(String message) {
        this.image = null;
        this.clipText = "";
        this.captionText = "";
        this.message = message;
        repaint();
    }

    @Override protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        Graphics2D g = (Graphics2D) graphics.create();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        int width = getWidth();
        int height = getHeight();
        if (image == null) {
            g.setColor(new Color(145, 154, 175));
            g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 16));
            FontMetrics metrics = g.getFontMetrics();
            g.drawString(message, Math.max(20, (width - metrics.stringWidth(message)) / 2), height / 2);
            g.dispose();
            return;
        }

        double scale = Math.min((double) width / image.getWidth(), (double) height / image.getHeight());
        int drawWidth = Math.max(1, (int) (image.getWidth() * scale));
        int drawHeight = Math.max(1, (int) (image.getHeight() * scale));
        int x = (width - drawWidth) / 2;
        int y = (height - drawHeight) / 2;
        g.drawImage(image, x, y, drawWidth, drawHeight, null);
        if (!clipText.isBlank()) drawOverlay(g, clipText, x, y, drawWidth, drawHeight, false);
        if (!captionText.isBlank()) drawOverlay(g, captionText, x, y, drawWidth, drawHeight, true);
        g.dispose();
    }

    private void drawOverlay(Graphics2D g, String text, int x, int y, int width, int height, boolean caption) {
        int size = Math.max(16, width / (caption ? 36 : 30));
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, size));
        String singleLine = text.replace('\n', ' ');
        FontMetrics metrics = g.getFontMetrics();
        int maxWidth = (int) (width * 0.84);
        if (metrics.stringWidth(singleLine) > maxWidth) {
            int length = Math.max(5, (int) ((double) singleLine.length() * maxWidth / metrics.stringWidth(singleLine)));
            singleLine = singleLine.substring(0, Math.min(length, singleLine.length())) + "…";
        }
        int textWidth = metrics.stringWidth(singleLine);
        int boxWidth = textWidth + 32;
        int boxHeight = metrics.getHeight() + 16;
        int boxX = x + (width - boxWidth) / 2;
        int boxY = y + height - boxHeight - (caption ? 24 : 74);
        g.setColor(new Color(0, 0, 0, caption ? 190 : 150));
        g.fillRoundRect(boxX, boxY, boxWidth, boxHeight, 16, 16);
        g.setColor(caption ? new Color(255, 232, 119) : Color.WHITE);
        g.drawString(singleLine, boxX + 16, boxY + 8 + metrics.getAscent());
    }
}
