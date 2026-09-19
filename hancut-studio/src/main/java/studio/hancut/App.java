package studio.hancut;

import studio.hancut.ui.MainFrame;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;

public final class App {
    private App() {}

    public static void main(String[] args) {
        if (args.length > 0 && "--self-check".equals(args[0])) {
            try {
                Diagnostics.run();
            } catch (Exception error) {
                error.printStackTrace();
                System.exit(1);
            }
            return;
        }
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception ignored) {
                // Use Swing's cross-platform fallback.
            }
            new MainFrame().setVisible(true);
        });
    }
}
