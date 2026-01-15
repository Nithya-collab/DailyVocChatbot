
import React from 'react';
import { VocabWord } from '../types';
import { Volume2 } from 'lucide-react';

interface WordDisplayProps {
  word: VocabWord;
}

export const WordDisplay: React.FC<WordDisplayProps> = ({ word }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row transition-all hover:shadow-md">
      <div className="w-full sm:w-1/3 aspect-square sm:aspect-auto overflow-hidden bg-gray-100">
        <img
          src={word.imageUrl}
          alt={word.word}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-6 flex-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-gray-900 capitalize">{word.word}</h3>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-blue-600">
            <Volume2 size={20} />
          </button>
        </div>
        <p className="text-sm font-medium text-gray-500 italic mb-3">/ {word.pronunciation} /</p>
        {word.tamilMeaning && (
          <p className="text-lg text-blue-600 font-medium mb-3">Meaning: {word.tamilMeaning}</p>
        )}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Definition</h4>
            <p className="text-gray-700 leading-relaxed">{word.definition}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Example</h4>
            <p className="text-gray-600 bg-gray-50 p-3 rounded-lg border-l-4 border-blue-500 italic">
              "{word.example}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
