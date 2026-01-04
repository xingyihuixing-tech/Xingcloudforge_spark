import type { Meta, StoryObj } from '@storybook/react';
import { AIStarButton } from './AIStarButton';
import React from 'react';

const meta: Meta<typeof AIStarButton> = {
    title: 'Components/AIStarButton',
    component: AIStarButton,
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'dark',
            values: [
                { name: 'dark', value: '#1a1a1a' },
                { name: 'light', value: '#ffffff' },
            ],
        },
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <div style={{
                '--xing-bg-image': 'linear-gradient(135deg, #60a5fa, #e879f9, #2bf6a5)',
                '--xing-bg-size': '200% 200%',
                '--xing-speed': '3s',
                '--xing-c1': '#60a5fa',
                '--xing-c2': '#e879f9'
            } as React.CSSProperties}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof AIStarButton>;

export const Default: Story = {};

export const ConicGradient: Story = {
    decorators: [
        (Story) => (
            <div style={{
                '--xing-bg-image': 'repeating-conic-gradient(from 0deg at 50% 50%, #60a5fa, #e879f9, #60a5fa)',
                '--xing-bg-size': '100% 100%',
                '--xing-speed': '5s',
                '--xing-c1': '#60a5fa',
                '--xing-c2': '#e879f9'
            } as React.CSSProperties}>
                <Story />
            </div>
        ),
    ],
};
